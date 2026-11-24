import { arriveAtQuestEntrance } from '../test-support/quest-entrance';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { deserializeWorld, parseQuestRunDoc, type ProgressState } from '@hexoflat/engine';
import type { InventoryState } from '@hexoflat/engine/inventory/inventory-state';
import { campObjectSpots } from '@hexoflat/engine/content/boards/camp-object-spot';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { coordinateKey, getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import { eq } from 'drizzle-orm';
import { itemLedger } from '../db/schema';
import { ensureExpedition, readServerDocument } from '../expedition/expedition-store';
import { WorldService } from '../world/world.service';
import { createTestKit, envelope, type TestKit } from '../player/player-test-kit';
import { QuestRunService } from './quest-run.service';

const dbAvailable = inject('dbAvailable');
const [BOARD] = campObjectSpots(HEXOBJECT_KEYS.QUEST_BOARD);
const NEAR = getHexNeighbors(BOARD)[0];
const FAR = { columnIndex: BOARD.columnIndex + 2, rowIndex: BOARD.rowIndex };

describe.skipIf(!dbAvailable)('the seeker run on the server (real Postgres)', () => {
  let kit: TestKit;
  let quests: QuestRunService;
  let world: WorldService;
  beforeAll(() => {
    kit = createTestKit();
    quests = new QuestRunService(kit.db, kit.heroes);
    world = new WorldService(kit.db, kit.heroes);
  });
  afterAll(async () => {
    await kit.close();
  });

  const progressOf = async (userId: string, heroId: string) =>
    (await kit.service.snapshot(userId, heroId)).aggregates.progress!;
  const stateOf = async (userId: string, heroId: string) =>
    (await progressOf(userId, heroId)).state as ProgressState;

  async function heroAt(at: typeof NEAR) {
    const { userId, heroId } = await kit.newPlayer();
    const { revision } = await progressOf(userId, heroId);
    const arrive = envelope(
      heroId,
      'ARRIVE',
      { locationKey: 'camping', mapId: randomUUID(), coordinates: at },
      revision,
      { aggregate: 'progress' },
    );
    delete (arrive.command.payload as { revision?: number }).revision;
    expect((await kit.service.execute(userId, arrive)).result).toBe('applied');
    const inventory = (await kit.service.snapshot(userId, heroId)).aggregates.inventory!;
    const accept = envelope(heroId, 'QUEST_ACCEPT', { questId: 'seeker-1' }, inventory.revision);
    expect((await kit.service.execute(userId, accept)).result).toBe('applied');
    await arriveAtQuestEntrance(kit, world, userId, heroId, at === NEAR);
    return { userId, heroId };
  }

  async function send(
    userId: string,
    heroId: string,
    type: string,
    payload: Record<string, unknown> = {},
    commandId?: string,
  ) {
    const { revision } = await progressOf(userId, heroId);
    const command = envelope(heroId, type, payload, revision, {
      aggregate: 'progress',
      ...(commandId ? { commandId } : {}),
    });
    delete (command.command.payload as { revision?: number }).revision;
    return quests.execute(userId, command);
  }

  const trailOf = async (userId: string, heroId: string) => {
    const expeditionId = await ensureExpedition(kit.db, userId, heroId);
    const raw = await readServerDocument(kit.db, expeditionId, 'srv-quest');
    return raw ? parseQuestRunDoc(raw).run.trail : null;
  };

  it('plays a quest to the real chest: entry paid, steps paid, milestone set, camp and card N+1 back', async () => {
    const { userId, heroId } = await heroAt(NEAR);
    const entered = await send(userId, heroId, 'QUEST_ENTER', { questId: 'seeker-1' });
    expect(entered.result).toBe('applied');
    expect(entered.quest).toMatchObject({ phase: 'walking' });
    const start = await stateOf(userId, heroId);
    expect(start.presence).toBeNull();
    expect(start.day?.questsCompleted).toBe(0);

    const trail = (await trailOf(userId, heroId))!;
    for (const hex of trail) {
      expect((await send(userId, heroId, 'QUEST_STEP', { hex })).result).toBe('applied');
    }
    const before = await stateOf(userId, heroId);
    expect(before.knowledge.current).toBe(50 - 20 - 10);
    expect(before.day).toMatchObject({ willSpent: start.day!.willSpent + 10, questsCompleted: 1 });
    const opened = await send(userId, heroId, 'QUEST_OPEN_CHEST');
    expect(opened.quest).toMatchObject({ phase: 'collect' });
    const left = await send(userId, heroId, 'QUEST_RETURN');
    expect(left.result).toBe('applied');
    expect(left.quest).toBeNull();

    const after = await stateOf(userId, heroId);
    expect(after.day).toEqual(before.day);
    expect(after.quests.done['seeker-1']).toBe(1);
    expect(after.quests.active).toEqual([]);
    expect(after.presence).toMatchObject({ locationKey: 'camping' });
    expect(await trailOf(userId, heroId)).toBeNull();
  });

  it('REQ-QST-018 applies a repeated commandId once and refuses another account', async () => {
    const { userId, heroId } = await heroAt(NEAR);
    const entered = await send(userId, heroId, 'QUEST_ENTER', { questId: 'seeker-1' });
    const trail = (await trailOf(userId, heroId))!;
    const id = randomUUID();
    const first = await send(userId, heroId, 'QUEST_STEP', { hex: trail[0] }, id);
    const willAfter = (await stateOf(userId, heroId)).knowledge.current;
    const { revision } = await progressOf(userId, heroId);
    const again = envelope(heroId, 'QUEST_STEP', { hex: trail[0] }, revision - 1, {
      aggregate: 'progress',
      commandId: id,
    });
    delete (again.command.payload as { revision?: number }).revision;
    const replay = await quests.execute(userId, again);
    expect(replay.replayed).toBe(true);
    expect(first.result).toBe('applied');
    expect((await stateOf(userId, heroId)).knowledge.current).toBe(willAfter);
    expect(entered.result).toBe('applied');

    const stranger = await kit.newPlayer();
    const foreign = envelope(heroId, 'QUEST_STEP_BACK', {}, revision, { aggregate: 'progress' });
    delete (foreign.command.payload as { revision?: number }).revision;
    await expect(quests.execute(stranger.userId, foreign)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('REQ-QST-019 gives the same quest state after a reload, mid-walk and at the chest', async () => {
    const { userId, heroId } = await heroAt(NEAR);
    await send(userId, heroId, 'QUEST_ENTER', { questId: 'seeker-1' });
    const trail = (await trailOf(userId, heroId))!;
    let last = await send(userId, heroId, 'QUEST_STEP', { hex: trail[0] });
    last = await send(userId, heroId, 'QUEST_STEP', { hex: trail[1] });
    expect((await quests.snapshot(userId, heroId)).quest).toEqual(last.quest);
    for (const hex of trail.slice(2)) last = await send(userId, heroId, 'QUEST_STEP', { hex });
    expect(last.quest?.chest).not.toBeNull();
    expect((await quests.snapshot(userId, heroId)).quest).toEqual(last.quest);
    last = await send(userId, heroId, 'QUEST_OPEN_CHEST');
    expect((await quests.snapshot(userId, heroId)).quest).toEqual(last.quest);
  });

  it('refuses a second ENTER and keeps the world shut during a run', async () => {
    const { userId, heroId } = await heroAt(NEAR);
    const first = await send(userId, heroId, 'QUEST_ENTER', { questId: 'seeker-1' });
    expect(first.result).toBe('applied');
    const second = await send(userId, heroId, 'QUEST_ENTER', { questId: 'seeker-1' });
    expect(second).toMatchObject({ result: 'rejected', code: 'QUEST_IN_PROGRESS' });

    const { revision } = await progressOf(userId, heroId);
    const blocked = await world.execute(userId, {
      commandId: randomUUID(),
      heroId,
      aggregate: 'progress',
      expectedRevision: revision,
      command: { type: 'WORLD_ENTER', payload: { heroId, locationKey: 'camping' } },
    });
    expect(blocked).toMatchObject({ result: 'rejected', code: 'QUEST_OPEN' });

    const gone = await send(userId, heroId, 'QUEST_GIVE_UP');
    expect(gone.result).toBe('applied');
    expect((await stateOf(userId, heroId)).quests.active).toEqual([]);
  });

  it('refuses ENTER when the hero does not stand beside the board', async () => {
    const { userId, heroId } = await heroAt(NEAR);
    const { revision } = await progressOf(userId, heroId);
    const move = envelope(
      heroId,
      'ARRIVE',
      { locationKey: 'camping', mapId: randomUUID(), coordinates: FAR },
      revision,
      { aggregate: 'progress' },
    );
    delete (move.command.payload as { revision?: number }).revision;
    await kit.service.execute(userId, move);
    const refused = await send(userId, heroId, 'QUEST_ENTER', { questId: 'seeker-1' });
    expect(refused).toMatchObject({ result: 'rejected', code: 'NOT_AT_QUEST_ENTRANCE' });
  });

  const bagOf = async (userId: string, heroId: string) =>
    ((await kit.service.snapshot(userId, heroId)).aggregates.inventory!.state as InventoryState)
      .bag;

  async function atRealChest() {
    const { userId, heroId } = await heroAt(NEAR);
    await send(userId, heroId, 'QUEST_ENTER', { questId: 'seeker-1' });
    const trail = (await trailOf(userId, heroId))!;
    for (const hex of trail) await send(userId, heroId, 'QUEST_STEP', { hex });
    return { userId, heroId, trail };
  }

  it('REQ-QST-023 opens the chest through the loot rule, hides the table and the seed, and lets the hero pick up', async () => {
    const { userId, heroId } = await atRealChest();
    const opened = await send(userId, heroId, 'QUEST_OPEN_CHEST');
    expect(opened.result).toBe('applied');
    const ground = opened.quest!.collect!.ground;
    expect(ground.length).toBeGreaterThan(0);
    expect(opened.quest!.chest).toMatchObject({ empty: true });
    expect(JSON.stringify(opened)).not.toMatch(/seed|lure|chest-loot|chestLootTableId/i);
    expect(await bagOf(userId, heroId)).toSatisfy((bag: unknown[]) =>
      bag.every((cell) => cell === null),
    );

    const [item] = ground;
    const taken = await send(userId, heroId, 'QUEST_PICKUP', { hex: item.hex });
    expect(taken.result).toBe('applied');
    expect(taken.quest!.collect!.ground).toHaveLength(ground.length - 1);
    const bag = await bagOf(userId, heroId);
    expect(bag.some((cell) => cell?.key === item.itemKey)).toBe(true);
    const rows = await kit.db.select().from(itemLedger).where(eq(itemLedger.heroId, heroId));
    expect(rows.some((row) => row.itemKey === item.itemKey && row.reason === 'pickup')).toBe(true);

    const again = await send(userId, heroId, 'QUEST_PICKUP', { hex: item.hex });
    expect(again).toMatchObject({ result: 'rejected', code: 'NO_LOOT_THERE' });
  });

  it('REQ-QST-038 keeps the chest drop out of the projection and the answer at the real chest', async () => {
    const { userId, heroId } = await atRealChest();
    const snapshot = await quests.snapshot(userId, heroId);
    expect(snapshot.quest!.chest).toMatchObject({ empty: false });
    expect(Object.keys(snapshot.quest!.chest!).sort()).toEqual(['empty', 'hex']);
    expect(JSON.stringify(snapshot)).not.toMatch(/drop|sword|guaranteed|seed|chest-loot|lure/i);
  });

  async function runDoc(userId: string, heroId: string) {
    const expeditionId = await ensureExpedition(kit.db, userId, heroId);
    return parseQuestRunDoc((await readServerDocument(kit.db, expeditionId, 'srv-quest'))!).run;
  }

  async function walkIntoLostTreasure(userId: string, heroId: string) {
    let run = await runDoc(userId, heroId);
    const trailKeys = new Set(run.trail.map(coordinateKey));
    const position = (r: typeof run) =>
      r.path.length > 0 ? r.path[r.path.length - 1].hex : r.start;
    const decoy = getHexNeighbors(position(run)).find(
      (hex) => coordinateKey(hex) in run.revealed && !trailKeys.has(coordinateKey(hex)),
    )!;
    await send(userId, heroId, 'QUEST_STEP', { hex: decoy });
    for (let guard = 0; guard < 14; guard += 1) {
      run = await runDoc(userId, heroId);
      if (run.phase !== 'walking') break;
      const line = run.lines[run.lines.length - 1];
      const next = line.values[run.path.length + 1 - line.fromStep];
      const hex = getHexNeighbors(position(run)).find(
        (candidate) => run.revealed[coordinateKey(candidate)]?.number === next,
      );
      if (!hex) break;
      await send(userId, heroId, 'QUEST_STEP', { hex });
    }
    return runDoc(userId, heroId);
  }

  it('REQ-QST-036 a false trail ends in a lost treasure: no chest in the answer, restore keeps the state, leaving frees the slot', async () => {
    let entered: { userId: string; heroId: string } | null = null;
    for (let attempt = 0; attempt < 30 && !entered; attempt += 1) {
      const candidate = await heroAt(NEAR);
      await send(candidate.userId, candidate.heroId, 'QUEST_ENTER', { questId: 'seeker-1' });
      const start = await runDoc(candidate.userId, candidate.heroId);
      const trailKeys = new Set(start.trail.map(coordinateKey));
      const hasDecoy = getHexNeighbors(start.start).some(
        (hex) => coordinateKey(hex) in start.revealed && !trailKeys.has(coordinateKey(hex)),
      );
      if (hasDecoy) entered = candidate;
    }
    const { userId, heroId } = entered!;
    const run = await walkIntoLostTreasure(userId, heroId);
    expect(run.phase).toBe('lost');
    const snapshot = await quests.snapshot(userId, heroId);
    expect(snapshot.quest).toMatchObject({ phase: 'lost', chest: null });
    expect(JSON.stringify(snapshot)).not.toMatch(/drop|seed|chest-loot|lure|trail/i);
    expect((await send(userId, heroId, 'QUEST_OPEN_CHEST')).result).toBe('rejected');
    const left = await send(userId, heroId, 'QUEST_GIVE_UP');
    expect(left.result).toBe('applied');
    expect(left.quest).toBeNull();
    const after = await stateOf(userId, heroId);
    expect(after.quests.active).toEqual([]);
    expect(after.quests.done['seeker-1']).toBeUndefined();
    expect(after.presence).toMatchObject({ locationKey: 'camping' });
  });

  it('REQ-QST-018 a repeated OPEN commandId gives one loot set, and two fresh ids at once give one success', async () => {
    const { userId, heroId } = await atRealChest();
    const id = randomUUID();
    const { revision } = await progressOf(userId, heroId);
    const make = (commandId: string) => {
      const command = envelope(heroId, 'QUEST_OPEN_CHEST', {}, revision, {
        aggregate: 'progress',
        commandId,
      });
      delete (command.command.payload as { revision?: number }).revision;
      return command;
    };
    const first = await quests.execute(userId, make(id));
    const replay = await quests.execute(userId, make(id));
    expect(first.result).toBe('applied');
    expect(replay.replayed).toBe(true);
    expect(replay.quest!.collect!.ground).toEqual(first.quest!.collect!.ground);

    const other = await atRealChest();
    const at = (await progressOf(other.userId, other.heroId)).revision;
    const build = () => {
      const command = envelope(other.heroId, 'QUEST_OPEN_CHEST', {}, at, {
        aggregate: 'progress',
        commandId: randomUUID(),
      });
      delete (command.command.payload as { revision?: number }).revision;
      return command;
    };
    const settled = await Promise.allSettled([
      quests.execute(other.userId, build()),
      quests.execute(other.userId, build()),
    ]);
    const applied = settled.filter(
      (entry) => entry.status === 'fulfilled' && entry.value.result === 'applied',
    );
    expect(applied).toHaveLength(1);
  });

  it('REQ-QST-018 refuses another account on OPEN and PICKUP', async () => {
    const { userId, heroId } = await atRealChest();
    const stranger = await kit.newPlayer();
    const { revision } = await progressOf(userId, heroId);
    for (const [type, payload] of [
      ['QUEST_OPEN_CHEST', {}],
      ['QUEST_PICKUP', { hex: NEAR }],
    ] as const) {
      const command = envelope(heroId, type, payload, revision, { aggregate: 'progress' });
      delete (command.command.payload as { revision?: number }).revision;
      await expect(quests.execute(stranger.userId, command)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    }
  });

  it('REQ-QST-019 restores the quest on the chest hex and in the collect phase, and return keeps the bag', async () => {
    const { userId, heroId, trail } = await atRealChest();
    const opened = await send(userId, heroId, 'QUEST_OPEN_CHEST');
    expect((await quests.snapshot(userId, heroId)).quest).toEqual(opened.quest);
    const [item] = opened.quest!.collect!.ground;
    const taken = await send(userId, heroId, 'QUEST_PICKUP', { hex: item.hex });
    expect((await quests.snapshot(userId, heroId)).quest).toEqual(taken.quest);
    const stepped = await send(userId, heroId, 'QUEST_STEP', { hex: trail[trail.length - 1] });
    expect(stepped.result).toBe('applied');
    expect((await quests.snapshot(userId, heroId)).quest).toEqual(stepped.quest);
    const willBefore = (await stateOf(userId, heroId)).knowledge.current;

    const left = await send(userId, heroId, 'QUEST_RETURN');
    expect(left.result).toBe('applied');
    expect((await stateOf(userId, heroId)).knowledge.current).toBe(willBefore);
    expect((await stateOf(userId, heroId)).quests.done['seeker-1']).toBe(1);
    expect((await bagOf(userId, heroId)).some((cell) => cell?.key === item.itemKey)).toBe(true);
  });
  it('pauses through the camping portal and discards an abandoned suspended run', async () => {
    const { userId, heroId } = await heroAt(NEAR);
    expect((await send(userId, heroId, 'QUEST_ENTER', { questId: 'seeker-1' })).result).toBe(
      'applied',
    );
    const paused = await send(userId, heroId, 'QUEST_PAUSE');
    expect(paused.result).toBe('applied');
    expect(paused.quest).toBeNull();
    expect((await stateOf(userId, heroId)).presence?.locationKey).toBe('camping');
    expect((await stateOf(userId, heroId)).day?.questsCompleted).toBe(0);
    expect((await quests.snapshot(userId, heroId)).quest).toBeNull();
    const expeditionId = await ensureExpedition(kit.db, userId, heroId);
    const stored = parseQuestRunDoc((await readServerDocument(kit.db, expeditionId, 'srv-quest'))!);
    expect(stored.suspended).toBe(true);
    const inventory = (await kit.service.snapshot(userId, heroId)).aggregates.inventory!;
    expect(
      (
        await kit.service.execute(
          userId,
          envelope(heroId, 'QUEST_ABANDON', { questId: 'seeker-1' }, inventory.revision),
        )
      ).result,
    ).toBe('applied');
    expect(await readServerDocument(kit.db, expeditionId, 'srv-quest')).toBeNull();
  });

  it('clones the origin map: hero where he stood, camping door on the marker hex, return to camp', async () => {
    const { userId, heroId } = await heroAt(NEAR);
    const expeditionId = await ensureExpedition(kit.db, userId, heroId);
    const presence = (await stateOf(userId, heroId)).presence!;
    const entranceWorld = JSON.parse(
      (await readServerDocument(kit.db, expeditionId, `srv-world:${presence.mapId}`))!,
    ) as { questEntrances: Record<string, string>; map: { tiles: unknown[] } };
    const silesia = await world.ensure(userId, heroId, 'silesia');
    const held = deserializeWorld(silesia, Date.now());
    const marker = held.map.tiles.find(
      (tile) => tile.hexobject?.id === entranceWorld.questEntrances['seeker-1'],
    )!;

    const entered = await send(userId, heroId, 'QUEST_ENTER', { questId: 'seeker-1' });
    expect(entered.result).toBe('applied');
    expect(entered.quest?.position).toEqual(presence.coordinates);
    expect(entered.quest?.board?.exit).toEqual(marker.coordinates);
    expect(entered.quest?.board?.border).toEqual([
      { hex: marker.coordinates, objectKey: HEXOBJECT_KEYS.CAMPING_ENTRANCE },
    ]);
    expect(entered.quest?.chest).toBeNull();
    const stored = parseQuestRunDoc((await readServerDocument(kit.db, expeditionId, 'srv-quest'))!);
    expect(stored.run.start).toEqual(presence.coordinates);
    expect(stored.run.field?.origin).toBe('silesia');
    expect(stored.run.field?.tiles).toHaveLength(held.map.tiles.length);
    expect(stored.camp?.locationKey).toBe('camping');
    expect(JSON.stringify(entered)).not.toContain('"tiles"');
  });
});
