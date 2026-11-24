import { EDimension } from '../dimensions/dimensions';
import { currentItemTokenSchema } from './token-schema';
import { sampleToken } from './token-test-setup';
import { containerStateSchema } from '../containers/container';
import { groundItemSchema } from '../battle/battle-state';
import { traderGoodSchema, buybackEntrySchema } from '../trade/trade-state';
import { listingSchema } from '../trade/listing-state';
import { itemDimensionOf } from '../inventory/item-dimension';
import { upcastAggregate } from '../aggregates/registry';
import { emptyProgressState } from '../aggregates/progress-state';
import { createServerWorld, serializeWorld, deserializeWorld } from '../world/server-world';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { describe, expect, it } from 'vitest';
import { createTokenFactory } from './factory/create-token-factory';
import { itemTokenSchema } from './token-schema';
import { inventoryStateSchema, emptyInventoryState } from '../inventory/inventory-state';
import { EHexobjectGroup, ETokenType } from '../abstraction/hexobject-abstraction';

function legacyUnique() {
  const result = createTokenFactory().createUnique('last-verdict', {
    seed: 'dimension-migration',
    sourceId: 'test:legacy',
    n: 0,
    mapTier: 4,
  });
  if (!result.ok) throw new Error(result.refusal.code);
  return result.value;
}

describe('legacy unique persistence characterization', () => {
  it('preserves the complete authored item through the inventory reader', () => {
    const token = legacyUnique();
    const state = emptyInventoryState('hero');
    state.bag[0] = {
      id: 'hero:0',
      key: 'sword',
      type: EHexobjectGroup.EQUIPMENT,
      amount: 1,
      token,
    };
    const loaded = inventoryStateSchema.parse(JSON.parse(JSON.stringify(state)));
    expect(loaded.bag[0]!.token).toEqual(token);
    expect(itemTokenSchema.parse(token)).toEqual(token);
    expect(token).toMatchObject({ uniqueKey: 'last-verdict', price: 2400, skills: ['b_strike'] });
  });
});

function oldAlien() {
  const token: Record<string, unknown> = { ...legacyUnique() };
  const tier = token.tier;
  delete token.tier;
  delete token.tokenType;
  delete token.dimension;
  return {
    ...token,
    origin: tier,
    rarity: 'god-executor',
    generatorVersion: 4,
    description: [
      {
        key: 'content.tokens.line.kind',
        params: {
          type: 'content.tokens.noun.sword',
          realm: 'content.tokens.realm.god-executor',
        },
      },
    ],
  };
}

describe('dimension compatibility reader', () => {
  it('migrates God Executor without rerolling or mutating stored input', () => {
    const old = oldAlien();
    const before = structuredClone(old);
    const loaded = itemTokenSchema.parse(old);
    const kept: Record<string, unknown> = { ...old };
    delete kept.origin;
    delete kept.rarity;
    expect(loaded).toEqual({
      ...kept,
      tier: 'unique',
      tokenType: 'alien',
      dimension: 'nowhere',
      description: [
        {
          key: 'content.tokens.line.kind',
          params: {
            type: 'content.tokens.noun.sword',
            tokenType: 'content.tokens.tokenType.alien',
          },
        },
      ],
    });
    expect(loaded.generatorVersion).toBe(4);
    expect(old).toEqual(before);
    expect(itemTokenSchema.parse(loaded)).toEqual(loaded);
  });

  it.each([ETokenType.GLOOM, ETokenType.IDOL, ETokenType.SPARK])(
    'derives %s ownership from stored family',
    (tokenType) => {
      const old: Record<string, unknown> = { ...sampleToken({ tokenType }) };
      delete old.dimension;
      const loaded = itemTokenSchema.parse(old);
      expect(loaded).toEqual({ ...old, dimension: sampleToken({ tokenType }).dimension });
      expect(itemDimensionOf({ key: 'sword', token: loaded })).toBe(loaded.dimension);
    },
  );

  it('rejects contradictory and unknown ownership rather than repairing it', () => {
    expect(itemTokenSchema.safeParse({ ...oldAlien(), dimension: EDimension.EARTH }).success).toBe(
      false,
    );
    expect(itemTokenSchema.safeParse({ ...oldAlien(), dimension: null }).success).toBe(false);
    expect(itemTokenSchema.safeParse({ ...oldAlien(), rarity: 'unknown' }).success).toBe(false);
    const missing: Record<string, unknown> = { ...sampleToken() };
    delete missing.dimension;
    expect(currentItemTokenSchema.safeParse(missing).success).toBe(false);
    expect(currentItemTokenSchema.safeParse(oldAlien()).success).toBe(false);
  });

  it('normalizes every nested item reader, including stored container contents', () => {
    const token = oldAlien();
    const expected = itemTokenSchema.parse(token);
    const entry = { key: 'sword', amount: 1, token };
    expect(traderGoodSchema.parse(entry).token).toEqual(expected);
    expect(buybackEntrySchema.parse({ ...entry, unitPrice: 100 }).token).toEqual(expected);
    expect(listingSchema.parse({ ...entry, unitPrice: 100 }).token).toEqual(expected);
    expect(
      groundItemSchema.parse({ itemKey: 'sword', amount: 1, hex: { q: 0, r: 0 }, token }).token,
    ).toEqual(expected);
    const container = {
      id: 'c',
      kind: 'chest',
      at: { q: 0, r: 0 },
      status: 'full',
      contents: [[{ itemKey: 'sword', amount: 1, guaranteed: true, token }]],
    };
    expect(containerStateSchema.parse(container).contents![0][0].token).toEqual(expected);
  });
});

describe('persisted dimension migration boundaries', () => {
  it('normalizes current aggregate versions without changing revision, quantity or slot identity', () => {
    const inventory = emptyInventoryState('hero');
    const old = { ...inventory, bag: [...inventory.bag] };
    const cell = {
      id: 'hero:0',
      key: 'sword',
      type: EHexobjectGroup.EQUIPMENT,
      amount: 1,
      token: oldAlien(),
    };
    const raw = { ...old, bag: [cell, ...old.bag.slice(1)] };
    const loaded = upcastAggregate('inventory', 3, raw, { heroId: 'hero' });
    expect(loaded.bag[0]).toEqual({ ...cell, token: itemTokenSchema.parse(cell.token) });
    expect(loaded.revision).toBe(raw.revision);
    const progress = emptyProgressState('hero');
    const rawProgress = {
      ...progress,
      listings: [
        { key: 'sword', amount: 1, unitPrice: 100, token: oldAlien() },
        ...progress.listings.slice(1),
      ],
    };
    const loadedProgress = upcastAggregate('progress', 11, rawProgress, { heroId: 'hero' });
    expect(loadedProgress.listings[0]!.token).toEqual(itemTokenSchema.parse(oldAlien()));
  });

  it('reports invalid saved tokens instead of silently discarding owned equipment', () => {
    expect(() =>
      HexObjectFactory.create(
        'sword',
        { columnIndex: 0, rowIndex: 0 },
        {
          token: { ...oldAlien(), dimension: EDimension.EARTH },
        },
      ),
    ).toThrow();
    expect(() =>
      HexObjectFactory.create(
        'shield',
        { columnIndex: 0, rowIndex: 0 },
        {
          token: oldAlien(),
        },
      ),
    ).toThrow('Token type differs');
  });

  it('normalizes ground tokens on world load without rerolling', () => {
    const world = createServerWorld('camping', 'migration-map', 'migration-seed', 'hero');
    const tile = world.map.tiles.find((entry) => !entry.hexobject)!;
    tile.hexobject = HexObjectFactory.create('sword', tile.coordinates);
    const chestTile = world.map.tiles.find((entry) => !entry.hexobject)!;
    chestTile.hexobject = HexObjectFactory.create('chest', chestTile.coordinates);
    const saved = serializeWorld(world);
    const raw = JSON.parse(JSON.stringify(saved)) as {
      map: {
        tiles: { hexobject?: { hexobjectKey: string; token?: unknown; container?: unknown } }[];
      };
    };
    const stored = raw.map.tiles.find(
      (entry: { hexobject?: { hexobjectKey: string } }) =>
        entry.hexobject?.hexobjectKey === 'sword',
    );
    stored!.hexobject!.token = oldAlien();
    const chest = raw.map.tiles.find((entry) => entry.hexobject?.hexobjectKey === 'chest')!;
    chest.hexobject!.container = {
      id: 'stored-chest',
      kind: 'chest',
      at: { q: 0, r: 0 },
      status: 'full',
      contents: [[{ itemKey: 'sword', amount: 1, guaranteed: false, token: oldAlien() }]],
    };
    const loaded = deserializeWorld(raw, 0);
    const restored = loaded.map.tiles.find((entry) => entry.hexobject?.hexobjectKey === 'sword');
    expect(restored!.hexobject!.token).toEqual(itemTokenSchema.parse(oldAlien()));
    const restoredChest = loaded.map.tiles.find(
      (entry) => entry.hexobject?.container?.id === 'stored-chest',
    )!;
    expect(restoredChest.hexobject!.container!.status).toBe('full');
    expect(restoredChest.hexobject!.container!.contents![0][0].token).toEqual(
      itemTokenSchema.parse(oldAlien()),
    );
  });
});
