import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { parseQuestRunDoc, type ProgressState } from '@hexoflat/engine';
import { isFreeHex } from '@hexoflat/engine/battle/battle-board';
import { hexNeighbours } from '@hexoflat/engine/battle/hex-battle-geom';
import { campObjectSpots } from '@hexoflat/engine/content/boards/camp-object-spot';
import { LOOT_TABLES } from '@hexoflat/engine/content/loot-tables.content';
import { HexObjectFactory } from '@hexoflat/engine/factory/hex-object-factory';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import {
  ensureExpedition,
  readServerDocument,
  writeServerDocument,
} from '../expedition/expedition-store';
import { QuestRunService } from '../quests/quest-run.service';
import {
  EHexActionTypeForTests,
  deserializeWorld,
  serializeWorld,
} from '../world/world-test-support';
import { WorldService, type WorldResponse } from '../world/world.service';
import { createTestKit, envelope, type TestKit } from './player-test-kit';

const dbAvailable = inject('dbAvailable');
const [BOARD] = campObjectSpots(HEXOBJECT_KEYS.QUEST_BOARD);
const NEAR = getHexNeighbors(BOARD)[0];

const STRUCTURAL_MARKERS = [
  '"guaranteed"',
  '"rolls"',
  '"entries"',
  '"chestLootTableId"',
  '"lootTableId"',
  '"drop"',
  '"discarded"',
  '"tables"',
  '"contents"',
  '"kind":"quest-chest"',
  '"kind":"grave"',
  '"status":"full"',
  '"rngSeed"',
];

function expectNoSecrets(label: string, payload: unknown, secrets: string[]) {
  const text = JSON.stringify(payload);
  for (const marker of STRUCTURAL_MARKERS)
    expect(text, `${label} has ${marker}`).not.toContain(marker);
  for (const id of Object.keys(LOOT_TABLES))
    expect(text, `${label} names table ${id}`).not.toContain(id);
  for (const secret of secrets) expect(text, `${label} leaks a secret`).not.toContain(secret);
}

describe.skipIf(!dbAvailable)(
  'CH-P0 no container answer or projection leaks seeds, tables or drops (real Postgres)',
  () => {
    let kit: TestKit;
    let world: WorldService;
    let quests: QuestRunService;

    beforeAll(() => {
      kit = createTestKit();
      world = new WorldService(kit.db, kit.heroes);
      quests = new QuestRunService(kit.db, kit.heroes);
    });
    afterAll(async () => {
      delete process.env.HEXOFLAT_E2E_FIXTURES;
      await kit.close();
    });

    const progressOf = async (userId: string, heroId: string) =>
      (await kit.service.snapshot(userId, heroId)).aggregates.progress!;

    async function sendWorld(
      userId: string,
      heroId: string,
      type: string,
      payload: Record<string, unknown>,
    ): Promise<WorldResponse> {
      return world.execute(userId, {
        commandId: randomUUID(),
        heroId,
        aggregate: 'progress',
        expectedRevision: (await progressOf(userId, heroId)).revision,
        command: { type, payload: { heroId, ...payload } },
      });
    }

    async function heldWorld(userId: string, heroId: string) {
      const expeditionId = await ensureExpedition(kit.db, userId, heroId);
      const presence = (await progressOf(userId, heroId)).state as { presence: { mapId: string } };
      const docKey = `srv-world:${presence.presence.mapId}`;
      const loaded = deserializeWorld(
        JSON.parse((await readServerDocument(kit.db, expeditionId, docKey))!),
        0,
      );
      return { expeditionId, docKey, loaded };
    }

    async function saveWorld(
      expeditionId: string,
      docKey: string,
      loaded: ReturnType<typeof deserializeWorld>,
    ) {
      await kit.db.transaction((tx) =>
        writeServerDocument(tx, expeditionId, docKey, JSON.stringify(serializeWorld(loaded))),
      );
    }

    it('world chest: the OPEN answer, a later tick, the world snapshot and the hero snapshot carry no seed, table or drop', async () => {
      const { userId, heroId } = await kit.newPlayer();
      await sendWorld(userId, heroId, 'WORLD_ENTER', { locationKey: 'cave' });
      const { expeditionId, docKey, loaded } = await heldWorld(userId, heroId);
      const spot = getHexNeighbors(loaded.heroCoordinates!).find((hex) => {
        const tile = loaded.map.tiles.find(
          (t) =>
            t.coordinates.columnIndex === hex.columnIndex &&
            t.coordinates.rowIndex === hex.rowIndex,
        );
        return !!tile && !tile.hexobject && tile.terrain === 'ground';
      })!;
      const tile = loaded.map.tiles.find(
        (t) =>
          t.coordinates.columnIndex === spot.columnIndex &&
          t.coordinates.rowIndex === spot.rowIndex,
      )!;
      tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.CHEST, spot);
      tile.isRevealed = true;
      await saveWorld(expeditionId, docKey, loaded);
      const secrets = [loaded.worldSeed, loaded.mapId].filter((value) => value.length > 6);

      const opened = await sendWorld(userId, heroId, 'WORLD_ACTION', {
        coordinates: spot,
        actionType: EHexActionTypeForTests.OPEN,
        toolKey: HEXOBJECT_KEYS.HAND,
      });
      expect(opened.result).toBe('applied');
      expect(opened.events.some((event) => event.type === 'CHEST_OPENED')).toBe(true);
      expectNoSecrets('OPEN answer', opened, [loaded.worldSeed]);
      const ticked = await sendWorld(userId, heroId, 'WORLD_TICK', {});
      expectNoSecrets('tick answer', ticked, [loaded.worldSeed]);
      expectNoSecrets('world snapshot', await world.snapshot(userId, heroId), [loaded.worldSeed]);
      expectNoSecrets(
        'hero snapshot',
        await kit.service.snapshot(userId, heroId),
        secrets.slice(0, 1),
      );
    });

    it('CH-P6 world: a cave chest holds its contents in the server document only; the snapshot before and after OPEN shows none', async () => {
      const { userId, heroId } = await kit.newPlayer();
      await sendWorld(userId, heroId, 'WORLD_ENTER', { locationKey: 'cave' });
      const { expeditionId, docKey, loaded } = await heldWorld(userId, heroId);
      const stored = loaded.map.tiles.find(
        (t) => t.hexobject?.hexobjectKey === HEXOBJECT_KEYS.CHEST && t.hexobject.container,
      )!;
      const contents = stored.hexobject!.container!.contents!;
      expect(contents.length).toBeGreaterThan(0);
      expect(JSON.stringify(await readServerDocument(kit.db, expeditionId, docKey))).toContain(
        'contents',
      );
      const secrets = [loaded.worldSeed, JSON.stringify(contents)];
      expectNoSecrets('snapshot before OPEN', await world.snapshot(userId, heroId), secrets);
      expectNoSecrets(
        'hero snapshot before OPEN',
        await kit.service.snapshot(userId, heroId),
        secrets,
      );
      const spot = getHexNeighbors(loaded.heroCoordinates!).find((hex) => {
        const tile = loaded.map.tiles.find(
          (t) =>
            t.coordinates.columnIndex === hex.columnIndex &&
            t.coordinates.rowIndex === hex.rowIndex,
        );
        return !!tile && !tile.hexobject && tile.terrain === 'ground';
      })!;
      const next = loaded.map.tiles.find(
        (t) =>
          t.coordinates.columnIndex === spot.columnIndex &&
          t.coordinates.rowIndex === spot.rowIndex,
      )!;
      next.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.CHEST, spot, {
        container: stored.hexobject!.container,
      });
      next.isRevealed = true;
      await saveWorld(expeditionId, docKey, loaded);
      const opened = await sendWorld(userId, heroId, 'WORLD_ACTION', {
        coordinates: spot,
        actionType: EHexActionTypeForTests.OPEN,
        toolKey: HEXOBJECT_KEYS.HAND,
      });
      expect(opened.result).toBe('applied');
      expectNoSecrets('OPEN answer', opened, secrets);
      expectNoSecrets('snapshot after OPEN', await world.snapshot(userId, heroId), secrets);
      expectNoSecrets(
        'hero snapshot after OPEN',
        await kit.service.snapshot(userId, heroId),
        secrets,
      );
    });

    it('F-S1 fixed: a world snapshot no longer names the table id of a full chest', async () => {
      const { userId, heroId } = await kit.newPlayer();
      await sendWorld(userId, heroId, 'WORLD_ENTER', { locationKey: 'cave' });
      const text = JSON.stringify(await world.snapshot(userId, heroId));
      expect(text).not.toContain('lootTableId');
      expect(text).not.toContain('cave-chest-loot');
      expect(text).toContain('"chest"');
    });

    async function wonGrave() {
      process.env.HEXOFLAT_E2E_FIXTURES = '1';
      const { userId, heroId } = await kit.newPlayer();
      await kit.service.grantItem(userId, heroId, HEXOBJECT_KEYS.SWORD, 1, 'dev');
      await sendWorld(userId, heroId, 'WORLD_ENTER', { locationKey: 'cave' });
      const { expeditionId, docKey, loaded } = await heldWorld(userId, heroId);
      const spot = getHexNeighbors(loaded.heroCoordinates!).find((hex) => {
        const tile = loaded.map.tiles.find(
          (t) =>
            t.coordinates.columnIndex === hex.columnIndex &&
            t.coordinates.rowIndex === hex.rowIndex,
        );
        return !!tile && !tile.hexobject && tile.terrain === 'ground';
      })!;
      const tile = loaded.map.tiles.find(
        (t) =>
          t.coordinates.columnIndex === spot.columnIndex &&
          t.coordinates.rowIndex === spot.rowIndex,
      )!;
      tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.SKELETON_PACK, spot);
      tile.isRevealed = true;
      await saveWorld(expeditionId, docKey, loaded);
      await sendWorld(userId, heroId, 'WORLD_ACTION', {
        coordinates: spot,
        actionType: EHexActionTypeForTests.ATTACK,
        toolKey: HEXOBJECT_KEYS.HAND,
      });
      await sendWorld(userId, heroId, 'WORLD_BATTLE', { kind: 'start' });
      await world.battleFixture(userId, heroId, { kind: 'finish', outcome: 'victory' });
      const held = await heldWorld(userId, heroId);
      const battle = held.loaded.battle!;
      const roomy = (hex: { q: number; r: number }) =>
        hexNeighbours(hex).filter((n) => isFreeHex(battle, n)).length;
      const grave = [...battle.collect!.graves].sort((a, b) => roomy(b.hex) - roomy(a.hex))[0].hex;
      const hero = battle.creatures.find((c) => c.side === 'heroes')!;
      hero.pos = hexNeighbours(grave).find((hex) => isFreeHex(battle, hex, hero.id))!;
      await saveWorld(held.expeditionId, held.docKey, held.loaded);
      return { userId, heroId, grave, seed: battle.seed, id: battle.id };
    }

    it('grave: the loot answer, the pickup answer, the battle view and the hero snapshot carry no seed, table or drop', async () => {
      const c = await wonGrave();
      const secrets = [c.seed];
      expectNoSecrets('battle view before loot', await world.snapshot(c.userId, c.heroId), secrets);
      expectNoSecrets(
        'hero snapshot before loot',
        await kit.service.snapshot(c.userId, c.heroId),
        secrets,
      );
      const looted = await sendWorld(c.userId, c.heroId, 'WORLD_BATTLE', {
        kind: 'hero',
        action: { kind: 'loot-grave', hex: c.grave },
      });
      expect(looted.result).toBe('applied');
      expectNoSecrets('loot answer', looted, secrets);
      const view = (await world.snapshot(c.userId, c.heroId)) as {
        battleView: { collect: { items: { hex: { q: number; r: number } }[] } };
      };
      expectNoSecrets('battle view', view, secrets);
      const item = view.battleView.collect.items[0];
      if (item) {
        const picked = await sendWorld(c.userId, c.heroId, 'WORLD_BATTLE', {
          kind: 'hero',
          action: { kind: 'pickup-loot', hex: item.hex },
        });
        expectNoSecrets('pickup answer', picked, secrets);
      }
      expectNoSecrets('hero snapshot', await kit.service.snapshot(c.userId, c.heroId), secrets);
    });

    async function questHero() {
      const { userId, heroId } = await kit.newPlayer();
      const { revision } = await progressOf(userId, heroId);
      const arrive = envelope(
        heroId,
        'ARRIVE',
        { locationKey: 'camping', mapId: randomUUID(), coordinates: NEAR },
        revision,
        { aggregate: 'progress' },
      );
      delete (arrive.command.payload as { revision?: number }).revision;
      expect((await kit.service.execute(userId, arrive)).result).toBe('applied');
      const inventory = (await kit.service.snapshot(userId, heroId)).aggregates.inventory!;
      const accept = envelope(heroId, 'QUEST_ACCEPT', { questId: 'seeker-1' }, inventory.revision);
      expect((await kit.service.execute(userId, accept)).result).toBe('applied');
      return { userId, heroId };
    }

    async function sendQuest(
      userId: string,
      heroId: string,
      type: string,
      payload: Record<string, unknown> = {},
    ) {
      const { revision } = await progressOf(userId, heroId);
      const command = envelope(heroId, type, payload, revision, { aggregate: 'progress' });
      delete (command.command.payload as { revision?: number }).revision;
      return quests.execute(userId, command);
    }

    it('quest chest: quest:result of every command, GET /player/quest and the hero snapshot carry no seed, table or stored drop', async () => {
      const { userId, heroId } = await questHero();
      const expeditionId = await ensureExpedition(kit.db, userId, heroId);
      const answers: unknown[] = [
        await sendQuest(userId, heroId, 'QUEST_ENTER', { questId: 'seeker-1' }),
      ];
      const docOf = async () =>
        parseQuestRunDoc((await readServerDocument(kit.db, expeditionId, 'srv-quest'))!);
      const { run } = await docOf();
      const secrets = [run.seed];
      for (const hex of run.trail)
        answers.push(await sendQuest(userId, heroId, 'QUEST_STEP', { hex }));
      const stored = (await docOf()).run.chest!.drop!;
      expect(stored.length).toBeGreaterThan(0);
      secrets.push(JSON.stringify(stored));
      expect((await docOf()).run.chest!.container!.contents!.length).toBe(1);
      answers.push(await quests.snapshot(userId, heroId));
      answers.push(await kit.service.snapshot(userId, heroId));
      const opened = await sendQuest(userId, heroId, 'QUEST_OPEN_CHEST');
      expect(opened.result).toBe('applied');
      answers.push(opened);
      const ground = (opened.quest as { collect: { ground: { hex: unknown }[] } }).collect.ground;
      if (ground[0])
        answers.push(await sendQuest(userId, heroId, 'QUEST_PICKUP', { hex: ground[0].hex }));
      answers.push(await quests.snapshot(userId, heroId));
      answers.push(await kit.service.snapshot(userId, heroId));
      answers.forEach((answer, index) =>
        expectNoSecrets(`quest answer #${index}`, answer, secrets),
      );
      expect(((await progressOf(userId, heroId)).state as ProgressState).presence).toBeNull();
    });
  },
);
