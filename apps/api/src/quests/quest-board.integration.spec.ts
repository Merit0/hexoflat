import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest';
import {
  deserializeWorld,
  parseQuestRunDoc,
  serializeWorld,
  type ProgressState,
} from '@hexoflat/engine';
import { campObjectSpots } from '@hexoflat/engine/content/boards/camp-object-spot';
import type { InventoryState } from '@hexoflat/engine/inventory/inventory-state';
import type { QuestOfferBoardProjection } from '@hexoflat/engine/quests/quest-board-projection';
import { getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import {
  ensureExpedition,
  readServerDocument,
  writeServerDocument,
} from '../expedition/expedition-store';
import { loadAggregatesForUpdate, saveAggregate } from '../player/aggregate-store';
import { createTestKit, envelope, type TestKit } from '../player/player-test-kit';
import { arriveAtQuestEntrance } from '../test-support/quest-entrance';
import { WorldService } from '../world/world.service';
import { QuestRunService } from './quest-run.service';

const dbAvailable = inject('dbAvailable');
const [campBoard] = campObjectSpots('quest-board');
const near = getHexNeighbors(campBoard)[0];
type Player = { userId: string; heroId: string };

describe.skipIf(!dbAvailable)('generated quest board (PostgreSQL)', () => {
  let kit: TestKit;
  let world: WorldService;
  let runs: QuestRunService;

  beforeAll(() => {
    kit = createTestKit();
    world = new WorldService(kit.db, kit.heroes);
    runs = new QuestRunService(kit.db, kit.heroes);
  });
  afterAll(async () => {
    await kit.close();
  });

  const snapshot = (player: Player) => kit.service.snapshot(player.userId, player.heroId);
  const state = (progress: { state: unknown }) =>
    progress.state as ProgressState & { questBoard?: QuestOfferBoardProjection };

  async function campPlayer(at = near) {
    const player = await kit.newPlayer();
    const { mapId } = deserializeWorld(
      await world.ensure(player.userId, player.heroId, 'camping'),
      Date.now(),
    );
    const { progress } = (await snapshot(player)).aggregates;
    const arrive = envelope(
      player.heroId,
      'ARRIVE',
      { mapId, locationKey: 'camping', coordinates: at },
      progress!.revision,
      { aggregate: 'progress' },
    );
    delete (arrive.command.payload as { revision?: number }).revision;
    expect((await kit.service.execute(player.userId, arrive)).result).toBe('applied');
    return player;
  }

  async function board(player: Player) {
    return state((await snapshot(player)).aggregates.progress!).questBoard!;
  }

  async function command(player: Player, type: string, payload: Record<string, unknown> = {}) {
    const aggregate = type.startsWith('QUEST_BOARD_') ? 'progress' : 'inventory';
    const { revision } = (await snapshot(player)).aggregates[aggregate]!;
    return envelope(player.heroId, type, payload, revision, { aggregate });
  }

  async function send(player: Player, type: string, payload: Record<string, unknown> = {}) {
    return kit.service.execute(player.userId, await command(player, type, payload));
  }

  async function patchProgress(player: Player, patch: (progress: ProgressState) => void) {
    await kit.db.transaction(async (tx) => {
      const { progress } = await loadAggregatesForUpdate(tx, player.heroId, ['progress']);
      patch(progress!.state);
      await saveAggregate(tx, player.heroId, 'progress', progress!.revision, progress!.state);
    });
  }

  async function runCommand(player: Player, type: string, payload: Record<string, unknown> = {}) {
    const { revision } = (await snapshot(player)).aggregates.progress!;
    const sent = envelope(player.heroId, type, payload, revision, { aggregate: 'progress' });
    delete (sent.command.payload as { revision?: number }).revision;
    return runs.execute(player.userId, sent);
  }

  async function runDoc(player: Player, expeditionId: string) {
    const raw = await readServerDocument(kit.db, expeditionId, 'srv-quest');
    if (!raw) throw new Error(`No quest run for ${player.heroId}`);
    return parseQuestRunDoc(raw);
  }

  it('syncs once under concurrent requests and rejects foreign IDs and direct template acceptance', async () => {
    const player = await campPlayer();
    const sync = await command(player, 'QUEST_BOARD_SYNC');
    const results = await Promise.all(
      [sync, { ...sync, commandId: randomUUID() }].map((sent) =>
        kit.service.execute(player.userId, sent),
      ),
    );
    expect(results.map(({ result }) => result).sort()).toEqual(['applied', 'conflict']);
    const initial = await board(player);
    expect(initial.offers).toHaveLength(7);
    expect(initial.refreshPrice).toBe(50);
    const repeat = await send(player, 'QUEST_BOARD_SYNC');
    expect(state(repeat.aggregates.progress!).questBoard).toEqual(initial);
    expect(repeat.events).toEqual([]);
    const other = await campPlayer();
    await send(other, 'QUEST_BOARD_SYNC');
    expect(await send(other, 'QUEST_ACCEPT', { questId: initial.offers[0].id })).toMatchObject({
      result: 'rejected',
      code: 'QUEST_OFFER_EXPIRED',
    });
    expect(await send(player, 'QUEST_ACCEPT', { questId: 'woodcutter' })).toMatchObject({
      result: 'rejected',
      code: 'QUEST_OFFER_REQUIRED',
    });
    const projected = JSON.stringify(initial);
    expect(projected).not.toMatch(/rngSeed|generationVersion|chestLootTableId|rulePool/);
  });

  it('claims the frozen token once, records template completion and refills the board', async () => {
    const player = await campPlayer();
    await send(player, 'QUEST_BOARD_SYNC');
    const initial = await board(player);
    const offer = initial.offers.find(({ templateId }) => templateId === 'bone-hunter')!;
    const reward = offer.rewards[0];
    if (reward.kind !== 'item') throw new Error('expected an item');
    expect(reward.token?.baseKey).toBe('underworld-shield');
    expect((await send(player, 'QUEST_ACCEPT', { questId: offer.id })).result).toBe('applied');
    await patchProgress(player, (progress) => {
      const active = progress.quests.active.find(({ questId }) => questId === offer.id)!;
      active.state = 'ready';
      active.progress = offer.goal.target;
    });

    const claim = await command(player, 'QUEST_CLAIM', { questId: offer.id });
    const results = await Promise.all(
      [claim, { ...claim, commandId: randomUUID() }].map((sent) =>
        kit.service.execute(player.userId, sent),
      ),
    );
    expect(results.map(({ result }) => result).sort()).toEqual(['applied', 'conflict']);
    const { inventory, progress } = (await snapshot(player)).aggregates;
    expect(
      (inventory!.state as InventoryState).bag.filter(
        (item) => item?.token?.id === reward.token!.id,
      ),
    ).toMatchObject([{ token: reward.token }]);
    const stored = state(progress!);
    expect(stored.quests.done).toEqual({ 'bone-hunter': 1 });
    expect(stored.day?.questsCompleted).toBe(1);
    expect(stored.questBoard!.offers).toHaveLength(7);
    expect(stored.questBoard!.offers.some(({ templateId }) => templateId === 'bone-hunter')).toBe(
      false,
    );
  });

  it('keeps old accepted template IDs claimable after generated offers are enabled', async () => {
    const player = await campPlayer();
    await kit.service.questFixture(player.userId, player.heroId, {
      active: [{ questId: 'scholar', progress: 15, state: 'ready' }],
    });
    await send(player, 'QUEST_BOARD_SYNC');
    expect((await board(player)).offers).toHaveLength(6);
    expect(await send(player, 'QUEST_CLAIM', { questId: 'scholar' })).toMatchObject({
      result: 'applied',
    });
    const after = state((await snapshot(player)).aggregates.progress!);
    expect(after.quests.done.scholar).toBe(1);
    expect(after.questBoard!.offers).toHaveLength(7);
  });

  it('charges 50, 75 and 100 once each, preserves taken offers and resets the price at rollover', async () => {
    const player = await campPlayer();
    await send(player, 'QUEST_BOARD_SYNC');
    const initial = await board(player);
    const taken = initial.offers.find(({ templateId }) => templateId === 'woodcutter')!;
    await send(player, 'QUEST_ACCEPT', { questId: taken.id });
    await patchProgress(player, ({ knowledge }) => {
      knowledge.current = 49;
    });
    const refresh = (expectedPrice: number) => ({ dayId: initial.dayId, expectedPrice });
    expect(await send(player, 'QUEST_BOARD_REFRESH', refresh(50))).toMatchObject({
      result: 'rejected',
      code: 'INSUFFICIENT_WILL',
    });
    expect(await board(player)).toEqual(initial);
    await patchProgress(player, ({ knowledge }) => {
      knowledge.current = 300;
      knowledge.capacity = 300;
    });
    const paid = await command(player, 'QUEST_BOARD_REFRESH', refresh(50));
    const parallel = await Promise.all(
      [paid, { ...paid, commandId: randomUUID() }].map((sent) =>
        kit.service.execute(player.userId, sent),
      ),
    );
    expect(parallel.map(({ result }) => result).sort()).toEqual(['applied', 'conflict']);
    expect((await kit.service.execute(player.userId, paid)).replayed).toBe(true);
    expect((await board(player)).refreshPrice).toBe(75);
    const latest = (await board(player)).offers.filter(({ id }) => id !== taken.id);
    expect(latest.some(({ id }) => initial.offers.some((offer) => offer.id === id))).toBe(false);

    for (const cost of [75, 100]) {
      expect(await send(player, 'QUEST_BOARD_REFRESH', refresh(cost))).toMatchObject({
        result: 'applied',
      });
    }
    const stateBefore = state((await snapshot(player)).aggregates.progress!);
    expect(stateBefore.knowledge.current).toBe(75);
    expect(stateBefore.day?.willSpent).toBe(225);
    expect(await send(player, 'QUEST_BOARD_REFRESH', refresh(125))).toMatchObject({
      result: 'rejected',
      code: 'QUEST_BOARD_STALE',
    });
    await send(player, 'QUEST_BOARD_SYNC');
    const current = await board(player);
    expect(current).toMatchObject({ dayId: initial.dayId + 1, refreshPrice: 50 });
    expect(current.offers).toContainEqual(taken);
  });

  it('expires available offers at UTC midnight and returns an abandoned same-day offer intact', async () => {
    const midnight = Date.UTC(2026, 10, 24);
    const clock = vi.spyOn(Date, 'now').mockReturnValue(midnight - 1);
    try {
      const player = await campPlayer();
      await send(player, 'QUEST_BOARD_SYNC');
      const initial = await board(player);
      const [a, b] = initial.offers.filter(
        ({ templateId }) => templateId !== 'bone-hunter' && !templateId.startsWith('seeker'),
      );
      await send(player, 'QUEST_ACCEPT', { questId: a.id });
      await send(player, 'QUEST_ABANDON', { questId: a.id });
      expect(await board(player)).toEqual(initial);
      await send(player, 'QUEST_ACCEPT', { questId: a.id });
      clock.mockReturnValue(midnight);
      expect(await send(player, 'QUEST_ACCEPT', { questId: b.id })).toMatchObject({
        result: 'rejected',
        code: 'QUEST_OFFER_EXPIRED',
      });
      await send(player, 'QUEST_BOARD_SYNC');
      expect((await board(player)).offers).toContainEqual(a);
      expect((await board(player)).offers.map(({ id }) => id)).not.toContain(b.id);
    } finally {
      clock.mockRestore();
    }
  });

  it('places the generated Seeker entrance on demand and retains the run after refilling', async () => {
    const player = await campPlayer();
    await send(player, 'QUEST_BOARD_SYNC');
    const offer = (await board(player)).offers.find(({ templateId }) => templateId === 'seeker-1')!;
    expect((await send(player, 'QUEST_ACCEPT', { questId: offer.id })).result).toBe('applied');
    await arriveAtQuestEntrance(kit, world, player.userId, player.heroId, true, offer.id);
    const entered = await runCommand(player, 'QUEST_ENTER', { questId: offer.id });
    expect(entered.quest?.offer).toEqual(offer);
    const expeditionId = await ensureExpedition(kit.db, player.userId, player.heroId);
    const { run } = await runDoc(player, expeditionId);
    expect(run.trail.length).toBe(offer.goal.target);
    for (const hex of run.trail) {
      expect((await runCommand(player, 'QUEST_STEP', { hex })).result).toBe('applied');
    }
    const restored = state((await snapshot(player)).aggregates.progress!);
    expect(restored.quests.done).toEqual({ 'seeker-1': 1 });
    expect(restored.questBoard!.offers.map(({ id }) => id)).not.toContain(offer.id);
    expect(restored.questBoard!.offers).toHaveLength(7);
    expect((await runs.snapshot(player.userId, player.heroId)).quest?.offer).toEqual(offer);
    expect((await runCommand(player, 'QUEST_OPEN_CHEST')).quest?.phase).toBe('collect');
    expect((await runCommand(player, 'QUEST_RETURN')).result).toBe('applied');
    expect(await board(player)).toEqual(restored.questBoard);
  });

  it('rejects a generated entrance with no reachable tile before charging', async () => {
    const player = await campPlayer();
    await send(player, 'QUEST_BOARD_SYNC');
    const terrain = deserializeWorld(
      await world.ensure(player.userId, player.heroId, 'silesia'),
      Date.now(),
    );
    terrain.heroCoordinates = null;
    const expeditionId = await ensureExpedition(kit.db, player.userId, player.heroId);
    const raw = JSON.stringify(serializeWorld(terrain));
    const key = `srv-world:${terrain.mapId}`;
    await kit.db.transaction((tx) => writeServerDocument(tx, expeditionId, key, raw));
    const offer = (await board(player)).offers.find(({ templateId }) => templateId === 'seeker-1')!;
    const before = (await snapshot(player)).aggregates;
    expect(await send(player, 'QUEST_ACCEPT', { questId: offer.id })).toMatchObject({
      result: 'rejected',
      code: 'NO_ROOM_FOR_QUEST_ENTRANCE',
    });
    expect((await snapshot(player)).aggregates).toEqual(before);
    expect(JSON.parse((await readServerDocument(kit.db, expeditionId, key))!)).toEqual(
      JSON.parse(raw),
    );
  });
});
