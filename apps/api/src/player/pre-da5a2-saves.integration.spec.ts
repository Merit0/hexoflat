import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  inject,
  it,
  vi,
} from 'vitest';
import { deserializeWorld, serializeWorld, type ProgressState } from '@hexoflat/engine';
import { campObjectSpots } from '@hexoflat/engine/content/boards/camp-object-spot';
import { tokenTypeOfDimension } from '@hexoflat/engine/dimensions/dimensions';
import { HexObjectFactory } from '@hexoflat/engine/factory/hex-object-factory';
import { questDimension, type QuestDefinition } from '@hexoflat/engine/quests/quest-definition';
import type { QuestOfferBoardProjection } from '@hexoflat/engine/quests/quest-board-projection';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { coordinateKey, getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import { heroAggregates } from '../db/schema';
import {
  ensureExpedition,
  readServerDocument,
  writeServerDocument,
} from '../expedition/expedition-store';
import { QuestRunService } from '../quests/quest-run.service';
import { arriveAtQuestEntrance } from '../test-support/quest-entrance';
import { loadWorldDocument } from '../world/world-documents';
import { EHexActionTypeForTests, onHeldMap, placeHeroIn } from '../world/world-test-support';
import { WorldService } from '../world/world.service';
import { loadAggregates, loadAggregatesForUpdate, saveAggregate } from './aggregate-store';
import { createTestKit, envelope, type TestKit } from './player-test-kit';

type Player = { userId: string; heroId: string };
type StoredOffer = { definition: QuestDefinition };
type StoredWorld = {
  contentVersion: number;
  mapId: string;
  battle: { activeId: string; seed: string } | null;
};

const [QUEST_BOARD] = campObjectSpots(HEXOBJECT_KEYS.QUEST_BOARD);
const NEAR_BOARD = getHexNeighbors(QUEST_BOARD)[0];
const OWNED = ['lantern-eater'];

function oldOffer<T extends StoredOffer>(offer: T) {
  const { rewardDropContext, ...definition } = offer.definition;
  const dimension = questDimension(offer.definition);
  return {
    ...offer,
    definition: {
      ...definition,
      dimension,
      ...(rewardDropContext
        ? {
            rewardDropContext: { tokenType: tokenTypeOfDimension(dimension), ...rewardDropContext },
          }
        : {}),
    },
  };
}

describe.skipIf(!inject('dbAvailable'))('saves written before DA5a-2 (real Postgres)', () => {
  let kit: TestKit;
  let world: WorldService;
  let quests: QuestRunService;

  beforeAll(() => {
    kit = createTestKit();
    world = new WorldService(kit.db, kit.heroes);
    quests = new QuestRunService(kit.db, kit.heroes);
  });
  afterAll(async () => {
    await kit.close();
  });

  const warn = vi.spyOn(Logger.prototype, 'warn');
  beforeEach(() => {
    warn.mockReset();
  });
  afterEach(() => {
    expect(warn).not.toHaveBeenCalled();
  });

  const aggregatesOf = async ({ userId, heroId }: Player) =>
    (await kit.service.snapshot(userId, heroId)).aggregates;
  const projectionOf = async (player: Player) =>
    (await aggregatesOf(player)).progress!.state as ProgressState & {
      questBoard: QuestOfferBoardProjection;
    };

  async function playerCommand(player: Player, type: string, payload: object, aggregate: string) {
    const { revision } = (await aggregatesOf(player))[aggregate as 'progress']!;
    const command = envelope(player.heroId, type, { ...payload }, revision, { aggregate });
    if (type === 'ARRIVE') delete (command.command.payload as { revision?: number }).revision;
    const result = await kit.service.execute(player.userId, command);
    expect(result).toMatchObject({ result: 'applied' });
  }

  async function worldCommand(player: Player, type: string, payload: Record<string, unknown>) {
    const { progress } = await aggregatesOf(player);
    return world.execute(player.userId, {
      commandId: randomUUID(),
      heroId: player.heroId,
      aggregate: 'progress',
      expectedRevision: progress!.revision,
      command: {
        type,
        payload: { heroId: player.heroId, ...onHeldMap(type, payload, progress!.state) },
      },
    });
  }

  async function playerWithOffers(): Promise<Player> {
    const player = await kit.newPlayer();
    const { mapId } = deserializeWorld(
      await world.ensure(player.userId, player.heroId, 'camping'),
      Date.now(),
    );
    await playerCommand(
      player,
      'ARRIVE',
      { mapId, locationKey: 'camping', coordinates: NEAR_BOARD },
      'progress',
    );
    await playerCommand(player, 'QUEST_BOARD_SYNC', {}, 'progress');
    return player;
  }

  const progressRow = (heroId: string) =>
    and(eq(heroAggregates.heroId, heroId), eq(heroAggregates.kind, 'progress'));

  async function storedProgress(heroId: string) {
    const [row] = await kit.db.select().from(heroAggregates).where(progressRow(heroId));
    return { version: row.schemaVersion, state: row.state as ProgressState };
  }

  async function saveProgressAsV12(heroId: string) {
    const { state } = await storedProgress(heroId);
    const old = {
      ...state,
      ownedUniques: OWNED,
      quests: { ...state.quests, offers: state.quests.offers!.map(oldOffer) },
    };
    await kit.db
      .update(heroAggregates)
      .set({ schemaVersion: 12, contentVersion: '2', state: old })
      .where(progressRow(heroId));
    return JSON.stringify(old);
  }

  async function storedDocument<T>(player: Player, key: string) {
    const expeditionId = await ensureExpedition(kit.db, player.userId, player.heroId);
    const raw = (await readServerDocument(kit.db, expeditionId, key))!;
    return { expeditionId, value: JSON.parse(raw) as T };
  }

  const writeDocument = (expeditionId: string, key: string, value: unknown) =>
    kit.db.transaction((tx) => writeServerDocument(tx, expeditionId, key, JSON.stringify(value)));

  async function openBattle(player: Player) {
    const { userId, heroId } = player;
    await kit.service.grantItem(userId, heroId, HEXOBJECT_KEYS.SWORD, 1, 'dev');
    await placeHeroIn(world, userId, heroId, 'cave');
    expect((await worldCommand(player, 'WORLD_ENTER', { locationKey: 'cave' })).result).toBe(
      'applied',
    );
    const { mapId } = (await projectionOf(player)).presence!;
    const key = `srv-world:${mapId}`;
    const { expeditionId, value } = await storedDocument<unknown>(player, key);
    const held = deserializeWorld(value, 0);
    const beside = new Set(getHexNeighbors(held.heroCoordinates!).map(coordinateKey));
    const tile = held.map.tiles.find(
      (entry) =>
        beside.has(coordinateKey(entry.coordinates)) &&
        !entry.hexobject &&
        entry.terrain === 'ground',
    )!;
    tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.SKELETON_PACK, tile.coordinates);
    tile.isRevealed = true;
    await writeDocument(expeditionId, key, serializeWorld(held));
    const attack = await worldCommand(player, 'WORLD_ACTION', {
      coordinates: tile.coordinates,
      actionType: EHexActionTypeForTests.ATTACK,
      toolKey: HEXOBJECT_KEYS.HAND,
    });
    expect(attack.result).toBe('applied');
    const start = await worldCommand(player, 'WORLD_BATTLE', { kind: 'start' });
    expect(start.result).toBe('applied');
    return { expeditionId, key, mapId };
  }

  it('DA5a2-3: loads progress v12, old offers and a v2 world with an open battle without loss', async () => {
    const player = await playerWithOffers();
    const { expeditionId, key, mapId } = await openBattle(player);
    const progress = await storedProgress(player.heroId);
    const projection = await projectionOf(player);
    const { value: saved } = await storedDocument<StoredWorld>(player, key);
    expect(saved.battle).toBeTruthy();

    const oldText = await saveProgressAsV12(player.heroId);
    for (const removed of ['"ownedUniques"', '"dimension":"earth"', '"tokenType":"idol"'])
      expect(oldText).toContain(removed);
    await writeDocument(expeditionId, key, { ...saved, contentVersion: 2 });

    expect(await projectionOf(player)).toEqual(projection);
    const loaded = await kit.db.transaction((tx) =>
      loadWorldDocument(tx, { expeditionId, heroId: player.heroId, mapId, now: 0 }),
    );
    expect(JSON.parse(JSON.stringify(serializeWorld(loaded!)))).toEqual({
      ...saved,
      contentVersion: 3,
    });
    expect((await storedDocument<StoredWorld>(player, key)).value.contentVersion).toBe(2);

    const enemyTurn = saved.battle!.activeId.startsWith('skeleton');
    const turn = enemyTurn
      ? { kind: 'run-enemy-turn' }
      : { kind: 'hero', action: { kind: 'end-turn' } };
    expect((await worldCommand(player, 'WORLD_BATTLE', turn)).result).toBe('applied');
    const after = (await storedDocument<StoredWorld & { map: unknown }>(player, key)).value;
    expect(after).toMatchObject({ contentVersion: 3, mapId, battle: { seed: saved.battle!.seed } });
    expect(after.map).toEqual((saved as StoredWorld & { map: unknown }).map);

    await kit.db.transaction(async (tx) => {
      const { progress: held } = await loadAggregatesForUpdate(tx, player.heroId, ['progress']);
      await saveAggregate(tx, player.heroId, 'progress', held!.revision, held!.state);
    });
    const written = await storedProgress(player.heroId);
    expect(written.version).toBe(13);
    expect(written.state.quests).toEqual(progress.state.quests);
    expect(written.state).not.toHaveProperty('ownedUniques');
    for (const { definition } of written.state.quests.offers!) {
      expect(definition).not.toHaveProperty('dimension');
      expect(definition.rewardDropContext ?? {}).not.toHaveProperty('tokenType');
    }
  });

  it('DA5a2-3: loads progress v12 without touching any other field', async () => {
    const player = await playerWithOffers();
    const before = await storedProgress(player.heroId);
    await saveProgressAsV12(player.heroId);
    const { progress } = await loadAggregates(kit.db, player.heroId, ['progress']);
    expect(progress!.state).toEqual(before.state);
  });

  it('DA5a2-3: an old offer is accepted, and its saved run in srv-quest plays on', async () => {
    const player = await playerWithOffers();
    await saveProgressAsV12(player.heroId);
    const offer = (await projectionOf(player)).questBoard.offers.find((entry) => entry.expedition)!;
    await playerCommand(player, 'QUEST_ACCEPT', { questId: offer.id }, 'inventory');
    await arriveAtQuestEntrance(kit, world, player.userId, player.heroId, true, offer.id);

    const run = async (type: string, payload: object) => {
      const { revision } = (await aggregatesOf(player)).progress!;
      const command = envelope(player.heroId, type, { ...payload }, revision, {
        aggregate: 'progress',
      });
      delete (command.command.payload as { revision?: number }).revision;
      return quests.execute(player.userId, command);
    };
    expect((await run('QUEST_ENTER', { questId: offer.id })).result).toBe('applied');
    const before = await quests.snapshot(player.userId, player.heroId);

    type RunDoc = { run: { generatedOffer: StoredOffer; trail: object[] } };
    const { expeditionId, value } = await storedDocument<RunDoc>(player, 'srv-quest');
    const old = {
      ...value,
      run: { ...value.run, generatedOffer: oldOffer(value.run.generatedOffer) },
    };
    expect(old.run.generatedOffer.definition.dimension).toBe('earth');
    await writeDocument(expeditionId, 'srv-quest', old);

    expect(await quests.snapshot(player.userId, player.heroId)).toEqual(before);
    expect((await run('QUEST_STEP', { hex: value.run.trail[0] })).result).toBe('applied');
    const stored = (await storedDocument<RunDoc>(player, 'srv-quest')).value;
    expect(stored.run.generatedOffer).toEqual(value.run.generatedOffer);
  });
});
