import { arriveAtQuestEntrance } from '../test-support/quest-entrance';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { parseQuestRunDoc, type ProgressState } from '@hexoflat/engine';
import type { InventoryState } from '@hexoflat/engine/inventory/inventory-state';
import { isAlive, isFreeHex } from '@hexoflat/engine/battle/battle-board';
import { lootTableIdOfKind } from '@hexoflat/engine/battle/battle-catalogue';
import { battlefieldSeed } from '@hexoflat/engine/battle/battlefield';
import type { BattleProjection } from '@hexoflat/engine/battle/projection';
import { hexKey, hexNeighbours, sameHex } from '@hexoflat/engine/battle/hex-battle-geom';
import { rollContainerContents } from '@hexoflat/engine/containers/create-container';
import type { LootLists } from '@hexoflat/engine/containers/container';
import { lootTableOf } from '@hexoflat/engine/content/loot-tables.content';
import { locationDropContext } from '@hexoflat/engine/registry/location-drop-context';
import { campObjectSpots } from '@hexoflat/engine/content/boards/camp-object-spot';
import { LOOT_TABLES, SKELETON_KING_TABLE_ID } from '@hexoflat/engine/content/loot-tables.content';
import { ALL_QUESTS } from '@hexoflat/engine/quests/all-quests';
import type { QuestDefinition } from '@hexoflat/engine/quests/quest-definition';
import { lootStreamLabel } from '@hexoflat/engine/loot/roll-loot';
import { HexObjectFactory } from '@hexoflat/engine/factory/hex-object-factory';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import { heroAggregates } from '../db/schema';
import {
  ensureExpedition,
  expeditionSeed,
  readServerDocument,
  writeServerDocument,
} from '../expedition/expedition-store';
import { QuestRunService } from '../quests/quest-run.service';
import {
  EHexActionTypeForTests,
  deserializeWorld,
  onHeldMap,
  serializeWorld,
  placeHeroIn,
} from '../world/world-test-support';
import { WorldService, type WorldResponse } from '../world/world.service';
import { createTestKit, envelope, type TestKit } from './player-test-kit';

const dbAvailable = inject('dbAvailable');
const [BOARD] = campObjectSpots(HEXOBJECT_KEYS.QUEST_BOARD);
const NEAR = getHexNeighbors(BOARD)[0];

const SECRET_KEYS = [
  'guaranteed',
  'rolls',
  'entries',
  'chestLootTableId',
  'lootTableId',
  'drop',
  'discarded',
  'tables',
  'contents',
  'sourceId',
  'rngSeed',
  'uniqueDrops',
  'alienRoll',
  'uniqueDropOverride',
  'chanceBp',
];

const SECRET_TEXTS = ['"status":"full"', `"${lootStreamLabel('', '').split(':')[0]}:`];

function secretKeysIn(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((item) => secretKeysIn(item, found));
  else if (value && typeof value === 'object')
    for (const [key, inner] of Object.entries(value)) {
      if (SECRET_KEYS.includes(key)) found.add(key);
      secretKeysIn(inner, found);
    }
  return found;
}

const HEX_WINDOW = 16;

function hexWindows(seed: string): string[] {
  const runs = seed.toLowerCase().match(/[0-9a-f]{16,}/g) ?? [];
  return runs.flatMap((run) =>
    Array.from({ length: run.length - HEX_WINDOW + 1 }, (_, i) => run.slice(i, i + HEX_WINDOW)),
  );
}

function separatorPattern(seed: string): RegExp | null {
  const parts = seed.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (parts.join('').length < 8) return null;
  return new RegExp(parts.join('[^a-zA-Z0-9]{0,3}'), 'i');
}

function seedLeak(text: string, seed: string): string | null {
  if (text.includes(seed)) return 'raw';
  if (separatorPattern(seed)?.test(text)) return 'with separators';
  const lower = text.toLowerCase();
  const window = hexWindows(seed).find((part) => lower.includes(part));
  return window ? `as hex ${window}` : null;
}

function expectNoSeeds(label: string, payload: unknown, seeds: string[]) {
  const text = JSON.stringify(payload);
  seeds.forEach((seed, index) =>
    expect(seedLeak(text, seed), `${label} leaks seed #${index}`).toBeNull(),
  );
}

function expectNoSecrets(label: string, payload: unknown, secrets: string[], seeds: string[] = []) {
  const text = JSON.stringify(payload);
  expectNoSeeds(label, payload, seeds);
  expect([...secretKeysIn(payload)], `${label} has a secret key`).toEqual([]);
  for (const marker of SECRET_TEXTS) expect(text, `${label} has ${marker}`).not.toContain(marker);
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

    async function serverSeeds(userId: string, heroId: string): Promise<string[]> {
      const expeditionId = await ensureExpedition(kit.db, userId, heroId);
      const [row] = await kit.db
        .select()
        .from(heroAggregates)
        .where(and(eq(heroAggregates.heroId, heroId), eq(heroAggregates.kind, 'progress')));
      const rngSeed = (row.serverState as { rngSeed?: string }).rngSeed;
      expect(rngSeed).toBeTruthy();
      return [await expeditionSeed(kit.db, expeditionId), rngSeed!];
    }

    async function sendWorld(
      userId: string,
      heroId: string,
      type: string,
      payload: Record<string, unknown>,
    ): Promise<WorldResponse> {
      const progress = await progressOf(userId, heroId);
      return world.execute(userId, {
        commandId: randomUUID(),
        heroId,
        aggregate: 'progress',
        expectedRevision: progress.revision,
        command: { type, payload: { heroId, ...onHeldMap(type, payload, progress.state) } },
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
      await placeHeroIn(world, userId, heroId, 'cave');
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
      const seeds = [loaded.worldSeed, ...(await serverSeeds(userId, heroId))];

      const opened = await sendWorld(userId, heroId, 'WORLD_ACTION', {
        coordinates: spot,
        actionType: EHexActionTypeForTests.OPEN,
        toolKey: HEXOBJECT_KEYS.HAND,
      });
      expect(opened.result).toBe('applied');
      expect(opened.events.some((event) => event.type === 'CONTAINER_OPENED')).toBe(true);
      expectNoSecrets('OPEN answer', opened, [loaded.worldSeed], seeds);
      const ticked = await sendWorld(userId, heroId, 'WORLD_TICK', {});
      expectNoSecrets('tick answer', ticked, [loaded.worldSeed], seeds);
      expectNoSecrets(
        'world snapshot',
        await world.snapshot(userId, heroId),
        [loaded.worldSeed],
        seeds,
      );
      expectNoSecrets(
        'hero snapshot',
        await kit.service.snapshot(userId, heroId),
        secrets.slice(0, 1),
        seeds,
      );
    });

    it('CH-P6 world: a cave chest holds its contents in the server document only; the snapshot before and after OPEN shows none', async () => {
      const { userId, heroId } = await kit.newPlayer();
      await placeHeroIn(world, userId, heroId, 'cave');
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
      await placeHeroIn(world, userId, heroId, 'cave');
      await sendWorld(userId, heroId, 'WORLD_ENTER', { locationKey: 'cave' });
      const text = JSON.stringify(await world.snapshot(userId, heroId));
      expect(text).not.toContain('lootTableId');
      expect(text).not.toContain('cave-chest-loot');
      expect(text).toContain('"chest"');
    });

    async function wonGrave(
      squadKey: string = HEXOBJECT_KEYS.SKELETON_PACK,
      boss: { tableId: string } | null = null,
    ) {
      process.env.HEXOFLAT_E2E_FIXTURES = '1';
      const { userId, heroId } = await kit.newPlayer();
      await kit.service.grantItem(userId, heroId, HEXOBJECT_KEYS.SWORD, 1, 'dev');
      await placeHeroIn(world, userId, heroId, 'cave');
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
      tile.hexobject = HexObjectFactory.create(squadKey as never, spot);
      tile.isRevealed = true;
      await saveWorld(expeditionId, docKey, loaded);
      await sendWorld(userId, heroId, 'WORLD_ACTION', {
        coordinates: spot,
        actionType: EHexActionTypeForTests.ATTACK,
        toolKey: HEXOBJECT_KEYS.HAND,
      });
      await sendWorld(userId, heroId, 'WORLD_BATTLE', { kind: 'start' });
      if (boss) await world.battleFixture(userId, heroId, { kind: 'force-unique-drops' });
      await world.battleFixture(userId, heroId, { kind: 'finish', outcome: 'victory' });
      const held = await heldWorld(userId, heroId);
      const battle = held.loaded.battle!;
      expect(battle.tokenSecret).toEqual({
        seed: held.loaded.worldSeed,
        mapId: held.loaded.mapId,
      });
      const roomy = (hex: { q: number; r: number }) =>
        hexNeighbours(hex).filter((n) => isFreeHex(battle, n)).length;
      const graves = battle.collect!.graves.filter(
        ({ tables }) => !boss || tables.includes(boss.tableId),
      );
      const grave = graves.sort((a, b) => roomy(b.hex) - roomy(a.hex))[0].hex;
      const hero = battle.creatures.find((c) => c.side === 'heroes')!;
      hero.pos = hexNeighbours(grave).find((hex) => isFreeHex(battle, hex, hero.id))!;
      await saveWorld(held.expeditionId, held.docKey, held.loaded);
      return {
        userId,
        heroId,
        grave,
        seed: battle.seed,
        id: battle.id,
        seeds: [battle.seed, held.loaded.worldSeed, ...(await serverSeeds(userId, heroId))],
      };
    }

    it('grave: the loot answer, the pickup answer, the battle view and the hero snapshot carry no seed, table or drop', async () => {
      const c = await wonGrave();
      const secrets = [c.seed];
      expectNoSecrets(
        'battle view before loot',
        await world.snapshot(c.userId, c.heroId),
        secrets,
        c.seeds,
      );
      expectNoSecrets(
        'hero snapshot before loot',
        await kit.service.snapshot(c.userId, c.heroId),
        secrets,
        c.seeds,
      );
      const looted = await sendWorld(c.userId, c.heroId, 'WORLD_BATTLE', {
        kind: 'hero',
        action: { kind: 'loot-grave', hex: c.grave },
      });
      expect(looted.result).toBe('applied');
      expectNoSecrets('loot answer', looted, secrets, c.seeds);
      const view = (await world.snapshot(c.userId, c.heroId)) as {
        battleView: { collect: { items: { hex: { q: number; r: number } }[] } };
      };
      expectNoSecrets('battle view', view, secrets, c.seeds);
      const item = view.battleView.collect.items[0];
      if (item) {
        const picked = await sendWorld(c.userId, c.heroId, 'WORLD_BATTLE', {
          kind: 'hero',
          action: { kind: 'pickup-loot', hex: item.hex },
        });
        expectNoSecrets('pickup answer', picked, secrets, c.seeds);
      }
      expectNoSecrets(
        'hero snapshot',
        await kit.service.snapshot(c.userId, c.heroId),
        secrets,
        c.seeds,
      );
    });

    it('DA5b-5 a boss grave with a forced Alien: no answer or projection carries a chance, a rule or a seed', async () => {
      const c = await wonGrave(HEXOBJECT_KEYS.BONE_COURT, { tableId: SKELETON_KING_TABLE_ID });
      const held = (await heldWorld(c.userId, c.heroId)).loaded.battle!;
      expect(held.uniqueDropOverride).toBeUndefined();
      const stored = held.collect!.graves.find((grave) => sameHex(grave.hex, c.grave))!;
      const uniques = stored.container!.contents!.flat().filter((drop) => drop.token?.uniqueKey);
      expect(uniques.map((drop) => drop.token!.uniqueKey)).toEqual([
        'lantern-eater',
        'last-verdict',
      ]);
      const { instanceId } = uniques[1].token!;
      const before = await world.snapshot(c.userId, c.heroId);
      expectNoSecrets('battle view before loot', before, [c.seed, instanceId!], c.seeds);
      const looted = await sendWorld(c.userId, c.heroId, 'WORLD_BATTLE', {
        kind: 'hero',
        action: { kind: 'loot-grave', hex: c.grave },
      });
      expect(looted.result).toBe('applied');
      expect(JSON.stringify(looted)).toContain(instanceId);
      expectNoSecrets('loot answer', looted, [c.seed], c.seeds);
      const view = (await world.snapshot(c.userId, c.heroId)) as { battleView: BattleProjection };
      expectNoSecrets('battle view after loot', view, [c.seed], c.seeds);
      const item = view.battleView.collect!.items.find(
        ({ token }) => token?.uniqueKey === 'last-verdict',
      );
      expect(item?.token).toMatchObject({ instanceId, tokenType: 'alien' });
      const picked = await sendWorld(c.userId, c.heroId, 'WORLD_BATTLE', {
        kind: 'hero',
        action: { kind: 'pickup-loot', hex: item!.hex },
      });
      expectNoSecrets('pickup answer', picked, [c.seed], c.seeds);
      expectNoSecrets(
        'hero snapshot',
        await kit.service.snapshot(c.userId, c.heroId),
        [c.seed],
        c.seeds,
      );
    });

    it('DA5b-5 the force hook is refused without the fixtures flag and cannot be sent as a command', async () => {
      const c = await wonGrave();
      process.env.HEXOFLAT_E2E_FIXTURES = '';
      await expect(
        world.battleFixture(c.userId, c.heroId, { kind: 'force-unique-drops' }),
      ).rejects.toThrow('FORBIDDEN');
      await expect(
        sendWorld(c.userId, c.heroId, 'WORLD_BATTLE', { kind: 'force-unique-drops' }),
      ).rejects.toThrow('INVALID_COMMAND');
      process.env.HEXOFLAT_E2E_FIXTURES = '1';
    });

    const itemsOf = (lists: LootLists) =>
      lists.map((list) => list.map(({ itemKey, amount }) => ({ itemKey, amount })));

    function predictFromPublicData(view: BattleProjection) {
      const [squadId, attempt] = view.id.split('#');
      const seed = battlefieldSeed(squadId, Number(attempt));
      return view.collect!.graves.map(({ hex }) => {
        const tables = view.creatures
          .filter((c) => c.side === 'enemies' && !isAlive(c) && sameHex(c.pos, hex))
          .flatMap((c) => lootTableIdOfKind(c.kind) ?? [])
          .map((id) => lootTableOf(id));
        return itemsOf(
          rollContainerContents({
            kind: 'grave',
            tables,
            seed,
            sourceId: view.id,
            targetKey: hexKey(hex),
            dropContext: locationDropContext('cave'),
          }),
        );
      });
    }

    it('LG5g-1 the client cannot reproduce the grave contents from client-visible battle data', async () => {
      const c = await wonGrave(HEXOBJECT_KEYS.BONE_COURT);
      const { battleView } = (await world.snapshot(c.userId, c.heroId)) as {
        battleView: BattleProjection;
      };
      const stored = (await heldWorld(c.userId, c.heroId)).loaded.battle!.collect!.graves;
      const actual = battleView.collect!.graves.map(({ hex }) =>
        itemsOf(stored.find((grave) => sameHex(grave.hex, hex))!.container!.contents!),
      );
      expect(actual.flat(2).length).toBeGreaterThan(0);
      expect(predictFromPublicData(battleView)).not.toEqual(actual);
    });

    async function boardHero() {
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
      return { userId, heroId };
    }

    async function questHero() {
      const { userId, heroId } = await boardHero();
      const inventory = (await kit.service.snapshot(userId, heroId)).aggregates.inventory!;
      const accept = envelope(heroId, 'QUEST_ACCEPT', { questId: 'seeker-1' }, inventory.revision);
      expect((await kit.service.execute(userId, accept)).result).toBe('applied');
      await arriveAtQuestEntrance(kit, world, userId, heroId);
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
      const seeds = [run.seed, ...(await serverSeeds(userId, heroId))];
      for (const hex of run.trail)
        answers.push(await sendQuest(userId, heroId, 'QUEST_STEP', { hex }));
      const stored = (await docOf()).run.chest!.container!.contents![0];
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
        expectNoSecrets(`quest answer #${index}`, answer, secrets, seeds),
      );
      expect(((await progressOf(userId, heroId)).state as ProgressState).presence).toBeNull();
    });

    it('DA5b-4 the same QUEST_CLAIM commandId sent twice leaves one unique instance', async () => {
      process.env.HEXOFLAT_E2E_FIXTURES = '1';
      const catalogue = ALL_QUESTS as Record<string, QuestDefinition>;
      const questId = 'bone-hunter';
      const authored = catalogue[questId];
      catalogue[questId] = {
        ...authored,
        rewards: [{ kind: 'item', itemKey: HEXOBJECT_KEYS.SWORD, amount: 1 }],
        rewardDropContext: { mapTier: 1, tier: 'unique', templateKey: 'lantern-eater' },
      };
      try {
        const { userId, heroId } = await boardHero();
        await kit.service.questFixture(userId, heroId, {
          active: [{ questId, progress: 1, state: 'ready' }],
        });
        const { revision } = (await kit.service.snapshot(userId, heroId)).aggregates.inventory!;
        const claim = envelope(heroId, 'QUEST_CLAIM', { questId }, revision);
        const first = await kit.service.execute(userId, claim);
        const again = await kit.service.execute(userId, claim);
        expect(first.result).toBe('applied');
        expect(again).toMatchObject({ result: 'applied', replayed: true, events: first.events });
        const inventory = (await kit.service.snapshot(userId, heroId)).aggregates.inventory!
          .state as InventoryState;
        const uniques = inventory.bag.filter((cell) => cell?.token?.tier === 'unique');
        expect(uniques.map((cell) => cell!.token!.uniqueKey)).toEqual(['lantern-eater']);
        expectNoSecrets('claim answer', first, [], await serverSeeds(userId, heroId));
      } finally {
        catalogue[questId] = authored;
      }
    });

    it('LG5f camp chest and quest reward: the claim answers and the hero snapshot carry no server seed', async () => {
      process.env.HEXOFLAT_E2E_FIXTURES = '1';
      const { userId, heroId } = await boardHero();
      const seeds = await serverSeeds(userId, heroId);
      const inventory = (await kit.service.snapshot(userId, heroId)).aggregates.inventory!;
      const chest = await kit.service.execute(
        userId,
        envelope(heroId, 'CLAIM_CAMP_CHEST', {}, inventory.revision),
      );
      expect(chest.result).toBe('applied');
      await kit.service.questFixture(userId, heroId, {
        active: [{ questId: 'woodcutter', progress: 10, state: 'ready' }],
      });
      const { revision } = (await kit.service.snapshot(userId, heroId)).aggregates.inventory!;
      const claimed = await kit.service.execute(
        userId,
        envelope(heroId, 'QUEST_CLAIM', { questId: 'woodcutter' }, revision),
      );
      expect(claimed.result).toBe('applied');
      expectNoSeeds('camp chest answer', chest, seeds);
      expectNoSeeds('quest claim answer', claimed, seeds);
      expectNoSeeds('hero snapshot', await kit.service.snapshot(userId, heroId), seeds);
    });
  },
);

describe('LG5f the seed detector', () => {
  const seed = '0123456789abcdef0123456789abcdef:quest:5f0e';

  it('finds a seed raw, with other separators and as a 16-hex substring', () => {
    expect(seedLeak(`x${seed}x`, seed)).toBe('raw');
    expect(seedLeak('quest:0123456789abcdef0123456789abcdef-quest-5f0e.3-4:0', seed)).toBe(
      'with separators',
    );
    expect(seedLeak('id 89abcdef01234567 end', seed)).toBe('as hex 89abcdef01234567');
  });

  it('passes text without the seed', () => {
    expect(seedLeak('quest:4be1c2d3a4f5.3-4:0', seed)).toBeNull();
  });
});

describe('CH-P7 the secrets guard fails when a stored container reaches a response', () => {
  const stored = {
    id: '3,4',
    kind: 'quest-chest',
    at: { q: 1, r: 2 },
    contents: [[{ itemKey: 'sword', amount: 1 }]],
    status: 'full',
  };
  const reordered = {
    status: 'full',
    contents: stored.contents,
    at: stored.at,
    kind: stored.kind,
    id: stored.id,
  };

  it('clean public data passes', () => {
    expect(() =>
      expectNoSecrets('clean', { quest: { chest: { hex: { q: 1, r: 2 }, empty: false } } }, []),
    ).not.toThrow();
  });

  it.each([
    ['in the stored key order', stored],
    ['in another key order', reordered],
  ])('a container injected %s is caught', (_name, container) => {
    expect(() =>
      expectNoSecrets('answer', { quest: { chest: { hex: { q: 1, r: 2 }, container } } }, []),
    ).toThrow();
  });

  it('a bare stream label, a table id and a seed are caught', () => {
    expect(() => expectNoSecrets('label', { x: lootStreamLabel('seed-a', '3,4') }, [])).toThrow();
    expect(() => expectNoSecrets('table', { x: Object.keys(LOOT_TABLES)[0] }, [])).toThrow();
    expect(() => expectNoSecrets('seed', { x: 'seed-abc' }, ['seed-abc'])).toThrow();
  });
});
