import { describe, expect, it } from 'vitest';
import { ETokenType } from '../abstraction/hexobject-abstraction';
import { emptyProgressState } from '../aggregates/progress-state';
import { AGGREGATES, upcastAggregate } from '../aggregates/registry';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { emptyInventoryState } from '../inventory/inventory-state';
import { EHexobjectGroup } from '../abstraction/hexobject-abstraction';
import { generateQuestOffers } from '../quests/quest-generator';
import { DEFAULT_DROP_CONTEXT } from '../tokens/drop-context';
import { LEGACY_TOKENS } from '../tokens/legacy-token-fixtures';
import { itemTokenSchema } from '../tokens/token-schema';
import { sampleToken } from '../tokens/token-test-setup';
import { createServerWorld, deserializeWorld, serializeWorld } from '../world/server-world';
import { upcastDimensionVocabulary } from './upcast-vocabulary';

const OLD_KEY: Readonly<Record<string, string>> = {
  dropContext: 'tokenOrigin',
  rewardDropContext: 'rewardOrigin',
};

function isToken(value: Record<string, unknown>): boolean {
  return (value.tier === 'base' || value.tier === 'unique') && 'tokenType' in value;
}

function isDropContext(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === 2 && keys[0] === 'mapTier' && keys[1] === 'tokenType';
}

function oldParam(value: unknown): unknown {
  return typeof value === 'string'
    ? value.replace('content.tokens.tokenType.', 'content.tokens.realm.')
    : value;
}

function oldToken(token: Record<string, unknown>): Record<string, unknown> {
  const { tier, tokenType, description, ...rest } = token;
  return {
    ...rest,
    origin: tier,
    rarity: tokenType,
    description: (description as { key: string; params: Record<string, unknown> }[]).map((line) => {
      const { tokenType: name, ...params } = line.params;
      return {
        ...line,
        params: Object.fromEntries(
          Object.entries(name === undefined ? params : { ...params, realm: name }).map(
            ([key, value]) => [key, oldParam(value)],
          ),
        ),
      };
    }),
  };
}

/** Writes a current document in the vocabulary that saves used before DA3b. */
function preDa3b(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(preDa3b);
  if (!value || typeof value !== 'object') return value;
  const source = value as Record<string, unknown>;
  if (isDropContext(source)) return { realm: source.tokenType, mapTier: source.mapTier };
  const walked = Object.fromEntries(
    Object.entries(source).map(([key, child]) => [OLD_KEY[key] ?? key, preDa3b(child)]),
  );
  return isToken(walked) ? oldToken(walked) : walked;
}

function json<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('DA3b-3: pre-DA3b saves load with identical tokens', () => {
  it('reads every legacy token fixture and a current token back to the same token', () => {
    for (const token of [...LEGACY_TOKENS, sampleToken({ tokenType: ETokenType.SPARK })]) {
      const old = preDa3b(json(token));
      expect(old).toHaveProperty('origin');
      expect(old).toHaveProperty('rarity');
      expect(itemTokenSchema.parse(old)).toEqual(token);
      expect(upcastDimensionVocabulary(old)).toEqual(token);
    }
  });

  it('upcasts inventory v3 to v4 without changing slots, ids or tokens', () => {
    expect(AGGREGATES.inventory.schemaVersion).toBe(4);
    const state = emptyInventoryState('hero');
    state.bag[0] = {
      id: 'hero:0',
      key: 'sword',
      type: EHexobjectGroup.EQUIPMENT,
      amount: 1,
      token: LEGACY_TOKENS[0],
    };
    const current = json(state);
    const old = preDa3b(current);
    const before = structuredClone(old);
    expect(upcastAggregate('inventory', 3, old, { heroId: 'hero' })).toEqual(
      AGGREGATES.inventory.schema.parse(current),
    );
    expect(old).toEqual(before);
  });

  it('upcasts progress v11 to v12 with quest offers, rewards, listings and drop contexts', () => {
    expect(AGGREGATES.progress.schemaVersion).toBe(12);
    const progress = emptyProgressState('hero');
    const cave = { tokenType: ETokenType.GLOOM, mapTier: 3 } as const;
    const offers = generateQuestOffers({
      heroId: 'hero',
      rngSeed: 'da3b-seed',
      dayId: 1,
      issuedToday: 0,
      count: 7,
      log: { active: [], done: {} },
      locationDropContexts: {
        camping: DEFAULT_DROP_CONTEXT,
        silesia: DEFAULT_DROP_CONTEXT,
        'silesia-north': DEFAULT_DROP_CONTEXT,
        cave,
      },
    });
    expect(offers.some(({ definition }) => definition.rewardDropContext)).toBe(true);
    const current = json({
      ...progress,
      quests: { ...progress.quests, offers },
      listings: [
        { key: 'sword', amount: 1, unitPrice: 100, token: LEGACY_TOKENS[2] },
        ...progress.listings.slice(1),
      ],
    });
    const old = preDa3b(current);
    expect(JSON.stringify(old)).toContain('"rewardOrigin"');
    expect(JSON.stringify(old)).not.toContain('"rewardDropContext"');
    expect(upcastAggregate('progress', 11, old, { heroId: 'hero' })).toEqual(
      AGGREGATES.progress.schema.parse(current),
    );
  });

  it('loads an old world document with tokenOrigin and old ground tokens', () => {
    const world = createServerWorld('cave', 'da3b-map', 'da3b-seed', 'hero');
    const tile = world.map.tiles.find((entry) => !entry.hexobject)!;
    tile.hexobject = HexObjectFactory.create('sword', tile.coordinates, {
      token: LEGACY_TOKENS[0],
    });
    const current = json(serializeWorld(world));
    const old = preDa3b(current) as Record<string, unknown>;
    expect(old).toHaveProperty('tokenOrigin');
    expect(old).not.toHaveProperty('dropContext');
    expect(json(serializeWorld(deserializeWorld(old, 0)))).toEqual(current);
  });

  it('keeps a stored current name when both names are present and never mutates input', () => {
    const raw = {
      dropContext: { tokenType: 'idol', mapTier: 2 },
      tokenOrigin: { realm: 'gloom', mapTier: 4 },
      field: { tokenOrigin: { realm: 'gloom', mapTier: 4 } },
    };
    const before = structuredClone(raw);
    expect(upcastDimensionVocabulary(raw)).toEqual({
      dropContext: { tokenType: 'idol', mapTier: 2 },
      field: { dropContext: { tokenType: 'gloom', mapTier: 4 } },
    });
    expect(raw).toEqual(before);
  });
});
