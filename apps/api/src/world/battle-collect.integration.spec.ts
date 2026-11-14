import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { EHexActionTypeForTests, deserializeWorld, serializeWorld } from './world-test-support';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { HexObjectFactory } from '@hexoflat/engine/factory/hex-object-factory';
import { getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import {
  ensureExpedition,
  readServerDocument,
  writeServerDocument,
} from '../expedition/expedition-store';
import { createTestKit, envelope, type TestKit } from '../player/player-test-kit';
import { BATTLE_RULES } from '@hexoflat/engine/battle/battle-content';
import {
  LOOT_TABLES,
  SKELETON_WARRIOR_TABLE_ID,
} from '@hexoflat/engine/content/loot-tables.content';
import { lootTableSchema } from '@hexoflat/engine/loot/loot-table';
import { isFreeHex } from '@hexoflat/engine/battle/battle-board';
import { hexNeighbours } from '@hexoflat/engine/battle/hex-battle-geom';
import { itemLedger } from '../db/schema';
import { eq } from 'drizzle-orm';
import { WorldService, type WorldResponse } from './world.service';

const dbAvailable = inject('dbAvailable');

describe.skipIf(!dbAvailable)('battle close and restore as they are (real Postgres)', () => {
  let kit: TestKit;
  let world: WorldService;

  beforeAll(() => {
    kit = createTestKit();
    world = new WorldService(kit.db, kit.heroes);
  });
  afterAll(async () => {
    await kit.close();
  });

  async function send(
    userId: string,
    heroId: string,
    type: string,
    payload: Record<string, unknown>,
  ): Promise<WorldResponse> {
    const revision = (await kit.service.snapshot(userId, heroId)).aggregates.progress!.revision;
    return world.execute(userId, {
      commandId: randomUUID(),
      heroId,
      aggregate: 'progress',
      expectedRevision: revision,
      command: { type, payload: { heroId, ...payload } },
    });
  }

  async function openBattle() {
    const { userId, heroId } = await kit.newPlayer();
    await kit.service.grantItem(userId, heroId, HEXOBJECT_KEYS.SWORD, 1, 'dev');
    await send(userId, heroId, 'WORLD_ENTER', { locationKey: 'cave' });
    const expeditionId = await ensureExpedition(kit.db, userId, heroId);
    const presence = (
      (await kit.service.snapshot(userId, heroId)).aggregates.progress!.state as {
        presence: { mapId: string };
      }
    ).presence;
    const docKey = `srv-world:${presence.mapId}`;
    const loaded = deserializeWorld(
      JSON.parse((await readServerDocument(kit.db, expeditionId, docKey))!),
      0,
    );
    const spot = getHexNeighbors(loaded.heroCoordinates!).find((hex) => {
      const tile = loaded.map.tiles.find(
        (t) =>
          t.coordinates.columnIndex === hex.columnIndex && t.coordinates.rowIndex === hex.rowIndex,
      );
      return !!tile && !tile.hexobject && tile.terrain === 'ground';
    })!;
    const tile = loaded.map.tiles.find(
      (t) =>
        t.coordinates.columnIndex === spot.columnIndex && t.coordinates.rowIndex === spot.rowIndex,
    )!;
    tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.SKELETON_PACK, spot);
    tile.isRevealed = true;
    await kit.db.transaction((tx) =>
      writeServerDocument(tx, expeditionId, docKey, JSON.stringify(serializeWorld(loaded))),
    );
    const attack = await send(userId, heroId, 'WORLD_ACTION', {
      coordinates: spot,
      actionType: EHexActionTypeForTests.ATTACK,
      toolKey: HEXOBJECT_KEYS.HAND,
    });
    expect(attack.result).toBe('applied');
    await send(userId, heroId, 'WORLD_BATTLE', { kind: 'start' });
    return { userId, heroId, expeditionId, docKey, spot };
  }

  it('REQ-LOOT-076 a won battle restores as an ended victory and closes by freeing the squad hex', async () => {
    process.env.HEXOFLAT_E2E_FIXTURES = '1';
    try {
      const { userId, heroId, expeditionId, docKey, spot } = await openBattle();
      await world.battleFixture(userId, heroId, { kind: 'finish', outcome: 'victory' });
      const snapshot = (await world.snapshot(userId, heroId)) as {
        battleView: { phase: string; outcome: string } | null;
      };
      expect(snapshot.battleView).toMatchObject({ phase: 'ended', outcome: 'victory' });
      const closed = await send(userId, heroId, 'WORLD_BATTLE', { kind: 'close' });
      expect(closed.result).toBe('applied');
      expect(closed.events.map((event) => event.type)).toContain('SQUAD_DEFEATED');
      const stored = deserializeWorld(
        JSON.parse((await readServerDocument(kit.db, expeditionId, docKey))!),
        0,
      );
      const tile = stored.map.tiles.find(
        (t) =>
          t.coordinates.columnIndex === spot.columnIndex &&
          t.coordinates.rowIndex === spot.rowIndex,
      )!;
      expect(tile.hexobject).toBeNull();
      expect(stored.battle).toBeNull();
      const after = (await world.snapshot(userId, heroId)) as { battleView: unknown };
      expect(after.battleView).toBeNull();
    } finally {
      delete process.env.HEXOFLAT_E2E_FIXTURES;
    }
  });

  describe('with grave loot on', () => {
    const originalRules = BATTLE_RULES;
    const tables = LOOT_TABLES as Record<string, unknown>;
    const realWarriorTable = tables[SKELETON_WARRIOR_TABLE_ID];

    beforeAll(() => {
      world.battleRules = { ...originalRules, graveLootEnabled: true };
      tables[SKELETON_WARRIOR_TABLE_ID] = lootTableSchema.parse({
        id: SKELETON_WARRIOR_TABLE_ID,
        rolls: [1, 1],
        guaranteed: [{ itemKey: HEXOBJECT_KEYS.COINS, amount: [5, 5] }],
        entries: [{ itemKey: HEXOBJECT_KEYS.COINS, weight: 1, amount: [1, 1] }],
      });
    });
    afterAll(() => {
      world.battleRules = originalRules;
      tables[SKELETON_WARRIOR_TABLE_ID] = realWarriorTable;
    });

    interface Collected {
      userId: string;
      heroId: string;
      expeditionId: string;
      docKey: string;
      grave: { q: number; r: number };
    }

    async function won(): Promise<Collected> {
      process.env.HEXOFLAT_E2E_FIXTURES = '1';
      const opened = await openBattle();
      await world.battleFixture(opened.userId, opened.heroId, {
        kind: 'finish',
        outcome: 'victory',
      });
      const { userId, heroId, expeditionId, docKey } = opened;
      const held = await storedAt(expeditionId, docKey);
      const roomy = (hex: { q: number; r: number }) =>
        hexNeighbours(hex).filter((n) => isFreeHex(held.battle!, n)).length;
      const grave = [...held.battle!.collect!.graves].sort((a, b) => roomy(b.hex) - roomy(a.hex))[0]
        .hex;
      const hero = held.battle!.creatures.find((c) => c.side === 'heroes')!;
      hero.pos = hexNeighbours(grave).find((hex) => isFreeHex(held.battle!, hex, hero.id))!;
      await kit.db.transaction((tx) =>
        writeServerDocument(tx, expeditionId, docKey, JSON.stringify(serializeWorld(held))),
      );
      return { userId, heroId, expeditionId, docKey, grave };
    }

    afterAll(() => {
      delete process.env.HEXOFLAT_E2E_FIXTURES;
    });

    const storedAt = async (expeditionId: string, docKey: string) =>
      deserializeWorld(JSON.parse((await readServerDocument(kit.db, expeditionId, docKey))!), 0);

    async function loot(
      c: Collected,
      options: { commandId?: string; revision?: number } = {},
    ): Promise<WorldResponse> {
      const grave = c.grave;
      const revision =
        options.revision ??
        (await kit.service.snapshot(c.userId, c.heroId)).aggregates.progress!.revision;
      return world.execute(c.userId, {
        commandId: options.commandId ?? randomUUID(),
        heroId: c.heroId,
        aggregate: 'progress',
        expectedRevision: revision,
        command: {
          type: 'WORLD_BATTLE',
          payload: { heroId: c.heroId, kind: 'hero', action: { kind: 'loot-grave', hex: grave } },
        },
      });
    }

    const view = async (c: Collected) =>
      ((await world.snapshot(c.userId, c.heroId)) as { battleView: Record<string, unknown> })
        .battleView;

    it('REQ-LOOT-092 the same commandId twice gives one loot set and a replayed marker', async () => {
      const c = await won();
      const revision = (await kit.service.snapshot(c.userId, c.heroId)).aggregates.progress!
        .revision;
      const commandId = randomUUID();
      const first = await loot(c, { commandId, revision });
      expect(first.result).toBe('applied');
      const placed = (await view(c)).collect as { items: unknown[] };
      const again = await loot(c, { commandId, revision });
      expect(again).toMatchObject({ result: 'applied', replayed: true });
      expect(((await view(c)).collect as { items: unknown[] }).items).toEqual(placed.items);
    });

    it('REQ-LOOT-093 two different commandIds at once let exactly one succeed', async () => {
      const c = await won();
      const revision = (await kit.service.snapshot(c.userId, c.heroId)).aggregates.progress!
        .revision;
      const results = await Promise.all([loot(c, { revision }), loot(c, { revision })]);
      expect(results.filter((r) => r.result === 'applied')).toHaveLength(1);
      const graves = ((await view(c)).collect as { graves: { examined: boolean }[] }).graves;
      expect(graves.filter((g) => g.examined)).toHaveLength(1);
    });

    it('REQ-LOOT-094 no answer and no projection carries the seed, a table or a discarded drop', async () => {
      const c = await won();
      const answer = await loot(c);
      const held = await storedAt(c.expeditionId, c.docKey);
      const seed = held.battle!.seed;
      for (const text of [JSON.stringify(answer), JSON.stringify(await view(c))]) {
        expect(text).not.toContain(seed);
        expect(text).not.toContain('-loot');
        expect(text).not.toContain('"guaranteed"');
        expect(text).not.toContain('"rolls"');
        expect(text).not.toContain('"entries"');
        expect(text).not.toContain('"tables"');
        expect(text).not.toContain('"fallen"');
        expect(text).not.toContain('lootEnabled');
      }
    });

    it('REQ-LOOT-095 another account is FORBIDDEN and the grave stays unexamined', async () => {
      const c = await won();
      const other = await kit.newPlayer();
      const grave = c.grave;
      await expect(
        world.execute(other.userId, {
          commandId: randomUUID(),
          heroId: c.heroId,
          aggregate: 'progress',
          expectedRevision: 0,
          command: {
            type: 'WORLD_BATTLE',
            payload: { heroId: c.heroId, kind: 'hero', action: { kind: 'loot-grave', hex: grave } },
          },
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(
        ((await view(c)).collect as { graves: { examined: boolean }[] }).graves[0].examined,
      ).toBe(false);
    });

    it('REQ-LOOT-096 a restored session shows the same graves, items, quantities and hero hex before and after', async () => {
      const c = await won();
      const before = await view(c);
      expect(await view(c)).toEqual(before);
      expect(before).toMatchObject({ phase: 'ended', outcome: 'victory', lootLeft: true });
      await loot(c);
      const after = await view(c);
      expect(await view(c)).toEqual(after);
      const held = await storedAt(c.expeditionId, c.docKey);
      const hero = held.battle!.creatures.find((cr) => cr.side === 'heroes')!;
      const restoredHero = (after.creatures as { side: string; pos: unknown }[]).find(
        (cr) => cr.side === 'heroes',
      )!;
      expect(restoredHero.pos).toEqual(hero.pos);
      expect((after.collect as { items: unknown[] }).items.length).toBeGreaterThan(0);
    });

    it('REQ-LOOT-097 a refused loot answers with the code and changes nothing', async () => {
      const c = await won();
      await loot(c);
      const after = await view(c);
      const again = await loot(c);
      expect(again.result).toBe('rejected');
      expect(await view(c)).toEqual(after);
    });

    it('REQ-LOOT-098 a pickup writes the bag and a ledger row, a close keeps the bag', async () => {
      const c = await won();
      await loot(c);
      const held = await storedAt(c.expeditionId, c.docKey);
      const battle = held.battle!;
      const item = battle.collect!.items[0];
      const hero = battle.creatures.find((cr) => cr.side === 'heroes')!;
      hero.pos = hexNeighbours(item.hex).find((hex) => isFreeHex(battle, hex, hero.id))!;
      await kit.db.transaction((tx) =>
        writeServerDocument(tx, c.expeditionId, c.docKey, JSON.stringify(serializeWorld(held))),
      );
      const revision = (await kit.service.snapshot(c.userId, c.heroId)).aggregates.progress!
        .revision;
      const picked = await world.execute(c.userId, {
        commandId: randomUUID(),
        heroId: c.heroId,
        aggregate: 'progress',
        expectedRevision: revision,
        command: {
          type: 'WORLD_BATTLE',
          payload: {
            heroId: c.heroId,
            kind: 'hero',
            action: { kind: 'pickup-loot', hex: item.hex },
          },
        },
      });
      expect(picked.result).toBe('applied');
      const rows = await kit.db.select().from(itemLedger).where(eq(itemLedger.heroId, c.heroId));
      expect(rows.some((row) => row.itemKey === item.itemKey && row.reason === 'pickup')).toBe(
        true,
      );
      const bag = (await kit.service.snapshot(c.userId, c.heroId)).aggregates.inventory!;
      const closed = await world.execute(c.userId, {
        commandId: randomUUID(),
        heroId: c.heroId,
        aggregate: 'progress',
        expectedRevision: (await kit.service.snapshot(c.userId, c.heroId)).aggregates.progress!
          .revision,
        command: { type: 'WORLD_BATTLE', payload: { heroId: c.heroId, kind: 'close' } },
      });
      expect(closed.result).toBe('applied');
      expect((await kit.service.snapshot(c.userId, c.heroId)).aggregates.inventory!.state).toEqual(
        bag.state,
      );
      expect(
        ((await world.snapshot(c.userId, c.heroId)) as { battleView: unknown }).battleView,
      ).toBeNull();
    });

    it('REQ-LOOT-099 the exit warning milestone is set once and a repeat changes nothing', async () => {
      const { userId, heroId } = await kit.newPlayer();
      const send = async () => {
        const revision = (await kit.service.snapshot(userId, heroId)).aggregates.progress!.revision;
        const command = envelope(heroId, 'ACK_GRAVE_EXIT_WARNING', {}, revision, {
          aggregate: 'progress',
        });
        delete (command.command.payload as { revision?: number }).revision;
        return kit.service.execute(userId, command);
      };
      const first = await send();
      expect(first.result).toBe('applied');
      const state = (await kit.service.snapshot(userId, heroId)).aggregates.progress!;
      expect(
        (state.state as { graveExitWarningAcknowledged: boolean }).graveExitWarningAcknowledged,
      ).toBe(true);
      const second = await send();
      expect(second.result).toBe('applied');
      const again = (await kit.service.snapshot(userId, heroId)).aggregates.progress!;
      expect(again.revision).toBe(state.revision);
      expect(again.state).toEqual(state.state);
    });
  });
});
