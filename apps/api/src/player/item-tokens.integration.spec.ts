import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest';
import { CONTENT_VERSION } from '@hexoflat/engine';
import { ETokenType } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { inventoryV1Fixture } from '@hexoflat/engine/inventory/inventory-v1-fixture';
import { mintItem } from '@hexoflat/engine/inventory/inventory-state';
import { createTokenFactory } from '@hexoflat/engine/tokens/factory/create-token-factory';
import { LEGACY_SHIELD, LEGACY_SWORD } from '@hexoflat/engine/tokens/legacy-token-fixtures';
import { resolveTokenSprite } from '@hexoflat/engine/tokens/sprite-fallback';
import { SPRITE_MANIFEST } from '@hexoflat/engine/tokens/sprite-manifest';
import type { ItemToken } from '@hexoflat/engine/tokens/token-schema';
import type {
  InventoryState,
  InventoryStateItem,
} from '@hexoflat/engine/inventory/inventory-state';
import { heroAggregates } from '../db/schema';
import {
  ensureExpedition,
  readServerDocument,
  writeServerDocument,
} from '../expedition/expedition-store';
import { onHeldMap, placeHeroIn } from '../world/world-test-support';
import { WorldService } from '../world/world.service';
import { createTestKit, envelope, type TestKit } from './player-test-kit';

const dbAvailable = inject('dbAvailable');

function cellsOf(state: InventoryState): (InventoryStateItem | null)[] {
  return [...state.bag, ...Object.values(state.equip), ...state.stash.cells];
}

describe.skipIf(!dbAvailable)('item tokens in stored heroes (real Postgres)', () => {
  let kit: TestKit;
  let world: WorldService;
  beforeAll(() => {
    kit = createTestKit();
    world = new WorldService(kit.db, kit.heroes);
  });
  afterAll(async () => {
    await kit.close();
  });

  async function storeV1Inventory(heroId: string) {
    const stored = JSON.parse(JSON.stringify(inventoryV1Fixture(heroId))) as InventoryState;
    await kit.db
      .update(heroAggregates)
      .set({ schemaVersion: 1, revision: stored.revision, state: stored })
      .where(and(eq(heroAggregates.heroId, heroId), eq(heroAggregates.kind, 'inventory')));
    return stored;
  }

  function preDa3bToken(token: ItemToken): Record<string, unknown> {
    const { tier, tokenType, description, ...rest } = JSON.parse(
      JSON.stringify(token),
    ) as ItemToken;
    return {
      ...rest,
      origin: tier,
      rarity: tokenType,
      description: description.map(({ key, params }) => {
        const { tokenType: name, ...others } = params;
        return {
          key,
          params:
            name === undefined
              ? others
              : { ...others, realm: String(name).replace('.tokenType.', '.realm.') },
        };
      }),
    };
  }

  const inventoryOf = async (userId: string, heroId: string) =>
    (await kit.service.snapshot(userId, heroId)).aggregates.inventory!.state as InventoryState;

  it('loads legacy God Executor tokens as ALIEN/NOWHERE without rerolling (D2)', async () => {
    const { userId, heroId } = await kit.newPlayer();
    const inventory = await inventoryOf(userId, heroId);
    const made = createTokenFactory().createUnique('last-verdict', {
      seed: 'dimension-migration',
      sourceId: 'test:stored-alien',
      n: 0,
      mapTier: 4,
      ownedUniques: [],
    });
    if (!made.ok) throw new Error(made.refusal.code);
    const legacy: Record<string, unknown> = {
      ...preDa3bToken(made.value),
      rarity: 'god-executor',
      generatorVersion: 4,
    };
    delete legacy.dimension;
    const cell = mintItem(inventory, 'sword', 1);
    const raw = { ...inventory, bag: [{ ...cell, token: legacy }, ...inventory.bag.slice(1)] };
    await kit.db
      .update(heroAggregates)
      .set({ state: raw })
      .where(and(eq(heroAggregates.heroId, heroId), eq(heroAggregates.kind, 'inventory')));
    const loaded = await inventoryOf(userId, heroId);
    expect(loaded.bag[0]).toEqual({
      ...cell,
      token: { ...made.value, generatorVersion: 4 },
    });
    expect(await inventoryOf(userId, heroId)).toEqual(loaded);
    expect(loaded.revision).toBe(inventory.revision);
  });

  it('DA3b-3: loads a pre-DA3b inventory v3 and progress v11 with identical tokens', async () => {
    const { userId, heroId } = await kit.newPlayer();
    const before = await kit.service.snapshot(userId, heroId);
    const inventory = before.aggregates.inventory!.state as InventoryState;
    const progress = before.aggregates.progress!.state as Record<string, unknown> & {
      listings: unknown[];
    };
    const sword = mintItem(inventory, 'sword', 1);
    const shield = mintItem(inventory, 'shield', 1);
    const oldInventory = {
      ...inventory,
      bag: [
        { ...sword, token: preDa3bToken(LEGACY_SWORD) },
        { ...shield, token: preDa3bToken(LEGACY_SHIELD) },
        ...inventory.bag.slice(2),
      ],
    };
    const oldProgress = {
      ...progress,
      listings: [
        { key: 'sword', amount: 1, unitPrice: 100, token: preDa3bToken(LEGACY_SWORD) },
        ...progress.listings.slice(1),
      ],
    };
    await kit.db
      .update(heroAggregates)
      .set({ schemaVersion: 3, state: oldInventory })
      .where(and(eq(heroAggregates.heroId, heroId), eq(heroAggregates.kind, 'inventory')));
    await kit.db
      .update(heroAggregates)
      .set({ schemaVersion: 11, state: oldProgress })
      .where(and(eq(heroAggregates.heroId, heroId), eq(heroAggregates.kind, 'progress')));

    const loaded = await kit.service.snapshot(userId, heroId);
    const bag = (loaded.aggregates.inventory!.state as InventoryState).bag;
    expect(bag[0]).toEqual({ ...sword, token: LEGACY_SWORD });
    expect(bag[1]).toEqual({ ...shield, token: LEGACY_SHIELD });
    const listings = (loaded.aggregates.progress!.state as { listings: { token?: unknown }[] })
      .listings;
    expect(listings[0].token).toEqual(LEGACY_SWORD);
    expect(loaded.aggregates.inventory!.revision).toBe(before.aggregates.inventory!.revision);
  });

  it('DA4: an old inventory v4 with fallback sprites loads with null and draws the same sprites', async () => {
    const { userId, heroId } = await kit.newPlayer();
    const before = await kit.service.snapshot(userId, heroId);
    const inventory = before.aggregates.inventory!.state as InventoryState;
    const factory = createTokenFactory();
    const base = (tokenType: ETokenType.GLOOM | ETokenType.IDOL, n: number) => {
      const made = factory.createBase({
        seed: 'da4-old-save',
        sourceId: 'test:da4.old.save',
        n,
        tokenType,
        mapTier: 2,
        type: 'sword',
      });
      if (!made.ok) throw new Error(made.refusal.code);
      return made.value;
    };
    const made = factory.createUnique('last-verdict', {
      seed: 'da4-old-save',
      sourceId: 'test:da4.old.save',
      n: 9,
      mapTier: 4,
      ownedUniques: [],
    });
    if (!made.ok) throw new Error(made.refusal.code);
    const stored = [
      { token: base(ETokenType.GLOOM, 0), sprite: 'idol-sword-01', loaded: null },
      { token: base(ETokenType.IDOL, 1), sprite: 'idol-sword-01', loaded: 'idol-sword-01' },
      { token: made.value, sprite: '_placeholder', loaded: undefined },
    ];
    const state = structuredClone(inventory);
    const cells = stored.map(({ token, sprite }) => {
      const item = mintItem(state, 'sword', 1);
      state.idSeq += 1;
      return { ...item, token: { ...token, sprite } };
    });
    const old = { ...state, bag: [...cells, ...state.bag.slice(cells.length)] };
    await kit.db
      .update(heroAggregates)
      .set({ schemaVersion: 4, state: old })
      .where(and(eq(heroAggregates.heroId, heroId), eq(heroAggregates.kind, 'inventory')));

    const after = await kit.service.snapshot(userId, heroId);
    const bag = (after.aggregates.inventory!.state as InventoryState).bag;
    stored.forEach(({ token, sprite, loaded }, index) => {
      expect(bag[index]!.token).toEqual(token);
      expect(bag[index]!.token!.sprite).toBe(loaded);
      expect(resolveTokenSprite(SPRITE_MANIFEST, bag[index]!.token!).key).toBe(sprite);
    });
    expect(bag[2]!.token).not.toHaveProperty('sprite');
    expect(after.aggregates.inventory!.revision).toBe(before.aggregates.inventory!.revision);
  });

  describe('characterization', () => {
    it('loads a stored v1 inventory with the same items in the same places', async () => {
      const { userId, heroId } = await kit.newPlayer();
      const stored = await storeV1Inventory(heroId);
      const loaded = await inventoryOf(userId, heroId);
      expect(cellsOf(loaded).map((cell) => cell?.key ?? null)).toEqual(
        cellsOf(stored).map((cell) => cell?.key ?? null),
      );
      expect(cellsOf(loaded).filter(Boolean)).toHaveLength(6);
      expect(loaded.bag[1]).toEqual(stored.bag[1]);
      expect(loaded.bag[2]).toEqual(stored.bag[2]);
    });

    it('loads a world saved with the current content version on the same map', async () => {
      const { userId, heroId } = await kit.newPlayer();
      const first = (await world.ensure(userId, heroId, 'camping')) as { mapId: string };
      const expeditionId = await ensureExpedition(kit.db, userId, heroId);
      expect(
        await readServerDocument(kit.db, expeditionId, `srv-world:${first.mapId}`),
      ).not.toBeNull();
      const again = (await world.ensure(userId, heroId, 'camping')) as { mapId: string };
      expect(again.mapId).toBe(first.mapId);
    });
  });

  const tokenFields = (cell: InventoryStateItem | null) => {
    const token = cell!.token!;
    return { id: token.id, name: token.name, sprite: token.sprite, attributes: token.attributes };
  };

  const toBag = (heroId: string, revision: number) =>
    envelope(
      heroId,
      'MOVE_ITEM',
      { from: { container: 'equip', slot: 'weapon' }, to: { container: 'bag', index: 10 } },
      revision,
    );

  describe('TG-12: a hero keeps his token through a save and a reload', () => {
    it('saves the token and loads the same name, sprite and attributes', async () => {
      const { userId, heroId } = await kit.newPlayer();
      const stored = await storeV1Inventory(heroId);
      const loaded = await inventoryOf(userId, heroId);
      const before = tokenFields(loaded.equip.weapon);
      expect(loaded.equip.weapon!.token!.type).toBe('sword');

      const moved = await kit.service.execute(userId, toBag(heroId, stored.revision));
      expect(moved.result).toBe('applied');

      const [row] = await kit.db
        .select()
        .from(heroAggregates)
        .where(and(eq(heroAggregates.heroId, heroId), eq(heroAggregates.kind, 'inventory')));
      expect(row.schemaVersion).toBe(5);
      expect((row.state as InventoryState).bag[10]!.token).toEqual(loaded.equip.weapon!.token);

      const reloaded = await inventoryOf(userId, heroId);
      expect(reloaded.equip.weapon).toBeNull();
      expect(tokenFields(reloaded.bag[10])).toEqual(before);
      expect(reloaded.bag[10]!.token).toEqual(loaded.equip.weapon!.token);
    });
  });

  describe('TG-12 (EA3): new and old tokens survive a save and a reload', () => {
    function newShield(): ItemToken {
      const result = createTokenFactory().createBase(
        {
          seed: 'tg-12-ea3',
          sourceId: 'test:tg12',
          n: 0,
          tokenType: ETokenType.GLOOM,
          mapTier: 4,
          type: 'shield',
        },
        { attributes: [{ key: 'heart', value: 2 }] },
      );
      if (!result.ok) throw new Error(JSON.stringify(result.refusal));
      return result.value;
    }

    async function storeTokens(userId: string, heroId: string, tokens: ItemToken[]) {
      const state = structuredClone(await inventoryOf(userId, heroId));
      tokens.forEach((token, index) => {
        const item = mintItem(state, token.type as 'shield', 1);
        state.idSeq += 1;
        state.bag[index] = { ...item, token };
      });
      await kit.db
        .update(heroAggregates)
        .set({ state })
        .where(and(eq(heroAggregates.heroId, heroId), eq(heroAggregates.kind, 'inventory')));
      return state;
    }

    const saved = (token: ItemToken) => ({
      name: token.name,
      price: token.price,
      attributes: token.attributes,
      description: token.description,
      generatorVersion: token.generatorVersion,
    });

    it('reloads a new token with the same name, price and attributes after a save', async () => {
      const { userId, heroId } = await kit.newPlayer();
      const token = newShield();
      expect(token.name.kind).toBe('adjective');
      expect(token).toMatchObject({ baseKey: 'underworld-shield', dimension: 'underworld' });
      const stored = await storeTokens(userId, heroId, [token]);

      const moved = await kit.service.execute(
        userId,
        envelope(
          heroId,
          'MOVE_ITEM',
          { from: { container: 'bag', index: 0 }, to: { container: 'bag', index: 7 } },
          stored.revision,
        ),
      );
      expect(moved.result).toBe('applied');

      const reloaded = await inventoryOf(userId, heroId);
      expect(reloaded.bag[0]).toBeNull();
      expect(reloaded.bag[7]!.token).toEqual(token);
      expect(saved(reloaded.bag[7]!.token!)).toEqual(saved(token));
    });

    it('reloads old generator tokens unchanged, baked lines and all', async () => {
      const { userId, heroId } = await kit.newPlayer();
      await storeTokens(userId, heroId, [LEGACY_SWORD, LEGACY_SHIELD]);

      const reloaded = await inventoryOf(userId, heroId);
      expect(reloaded.bag[0]!.token).toEqual(LEGACY_SWORD);
      expect(reloaded.bag[1]!.token).toEqual(LEGACY_SHIELD);
      expect(reloaded.bag[0]!.token!.name.kind).toBe('generated');
    });
  });

  describe('another account', () => {
    it('can neither read nor change the inventory of a hero it does not own', async () => {
      const mine = await kit.newPlayer();
      const other = await kit.newPlayer();
      const stored = await storeV1Inventory(mine.heroId);
      await expect(kit.service.snapshot(other.userId, mine.heroId)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      await expect(
        kit.service.execute(other.userId, toBag(mine.heroId, stored.revision)),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      const unchanged = await inventoryOf(mine.userId, mine.heroId);
      expect(unchanged.equip.weapon!.token!.type).toBe('sword');
      expect(unchanged.bag[10]).toBeNull();
    });
  });

  describe('a stale map (D5)', () => {
    async function makeStale(expeditionId: string, mapId: string) {
      const key = `srv-world:${mapId}`;
      const raw = JSON.parse((await readServerDocument(kit.db, expeditionId, key))!) as {
        contentVersion: number;
      };
      raw.contentVersion = CONTENT_VERSION - 1;
      await kit.db.transaction((tx) =>
        writeServerDocument(tx, expeditionId, key, JSON.stringify(raw)),
      );
    }

    it('is replaced by a fresh map with the same id, with one warning and no error', async () => {
      const { userId, heroId } = await kit.newPlayer();
      const first = (await world.ensure(userId, heroId, 'camping')) as { mapId: string };
      const expeditionId = await ensureExpedition(kit.db, userId, heroId);
      await makeStale(expeditionId, first.mapId);
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      try {
        const again = (await world.ensure(userId, heroId, 'camping')) as { mapId: string };
        expect(again.mapId).toBe(first.mapId);
        expect(warn).toHaveBeenCalledTimes(1);
        const saved = JSON.parse(
          (await readServerDocument(kit.db, expeditionId, `srv-world:${first.mapId}`))!,
        ) as { contentVersion: number };
        expect(saved.contentVersion).toBe(CONTENT_VERSION);
        await world.ensure(userId, heroId, 'camping');
        expect(warn).toHaveBeenCalledTimes(1);
      } finally {
        warn.mockRestore();
      }
    });

    it('lets a world command run on the fresh map of the place the hero stands in', async () => {
      const { userId, heroId } = await kit.newPlayer();
      await placeHeroIn(world, userId, heroId, 'silesia');
      const progress = (await kit.service.snapshot(userId, heroId)).aggregates.progress!;
      const mapId = (progress.state as { presence: { mapId: string } }).presence.mapId;
      const expeditionId = await ensureExpedition(kit.db, userId, heroId);
      await makeStale(expeditionId, mapId);
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      try {
        const entered = await world.execute(userId, {
          commandId: randomUUID(),
          heroId,
          aggregate: 'progress',
          expectedRevision: progress.revision,
          command: {
            type: 'WORLD_ENTER',
            payload: {
              heroId,
              ...onHeldMap('WORLD_ENTER', { locationKey: 'silesia' }, progress.state),
            },
          },
        });
        expect(entered.result).toBe('applied');
        expect(entered.hero!.mapId).toBe(mapId);
        expect(warn).toHaveBeenCalledTimes(1);
      } finally {
        warn.mockRestore();
      }
    });
  });
});
