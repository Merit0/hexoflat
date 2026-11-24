import { describe, expect, it, vi } from 'vitest';
import { EDimension } from '../dimensions/dimensions';
import { availableInDimension } from '../dimensions/availability';
import { ETokenType } from '../abstraction/hexobject-abstraction';
import { BASE_ITEMS } from '../content/base-items.content';
import { TOKEN_CONTENT } from '../content/token-content';
import { TOKEN_UNIQUES } from '../content/token-uniques.content';
import { createTokenFactory } from './factory/create-token-factory';
import { itemTokenSchema } from './token-schema';
import { createContainer } from '../containers/create-container';
import { rollLoot } from '../loot/roll-loot';
import type { LootTable } from '../loot/loot-table';
import { dropAvailableIn } from '../loot/dimension-pool';
import { createSeededRandom } from '../utils/random-seeded';

const context = {
  seed: 'dimension-pools',
  sourceId: 'test:scope',
  n: 0,
  mapTier: 1 as const,
  tokenType: ETokenType.SPARK,
};
const factory = createTokenFactory();

function baseToken(baseKey: string, tokenType = ETokenType.SPARK) {
  const result = factory.createBase({ ...context, baseKey, tokenType });
  if (!result.ok) throw new Error(result.refusal.code);
  return result.value;
}

describe('separate concrete dimensional catalogues', () => {
  it.each([
    [ETokenType.IDOL, EDimension.EARTH],
    [ETokenType.GLOOM, EDimension.UNDERWORLD],
    [ETokenType.SPARK, EDimension.HEAVEN],
  ] as const)('%s selects only owned base definitions', (tokenType, dimension) => {
    for (let n = 0; n < 100; n++) {
      const made = factory.createBase({ ...context, tokenType, n });
      if (!made.ok) throw new Error(made.refusal.code);
      const definition = BASE_ITEMS.find((entry) => entry.key === made.value.baseKey)!;
      expect(definition.dimension).toBe(dimension);
      expect(made.value.dimension).toBe(definition.dimension);
      expect(made.value.type).toBe(definition.type);
    }
  });

  it('refuses an EARTH base key in HEAVEN instead of recoloring it', () => {
    expect(factory.createBase({ ...context, baseKey: 'earth-sword' })).toMatchObject({
      ok: false,
      refusal: { code: 'BASE_ITEM_NOT_IN_DIMENSION' },
    });
    expect(baseToken('heaven-sword')).toMatchObject({
      baseKey: 'heaven-sword',
      tokenType: 'spark',
    });
    expect(factory.createBase({ ...context, baseKey: 'missing' }).ok).toBe(false);
    expect(
      itemTokenSchema.safeParse({ ...baseToken('heaven-sword'), baseKey: 'earth-sword' }).success,
    ).toBe(false);
  });

  it('permits an explicitly shared base and preserves its owner in a foreign dimension', () => {
    const shared = createTokenFactory({
      ...TOKEN_CONTENT,
      baseItems: TOKEN_CONTENT.baseItems.map((item) =>
        item.key === 'earth-sword' ? { ...item, sharedWith: 'all' as const } : item,
      ),
    });
    const result = shared.createBase({ ...context, baseKey: 'earth-sword' });
    if (!result.ok) throw new Error(result.refusal.code);
    expect(result.value).toMatchObject({
      baseKey: 'earth-sword',
      dimension: 'earth',
      tokenType: 'idol',
    });
    expect(itemTokenSchema.parse(result.value)).toEqual(result.value);
  });

  it('applies the selected base attribute pool to both rolling and explicit overrides', () => {
    const restricted = createTokenFactory({
      ...TOKEN_CONTENT,
      baseItems: TOKEN_CONTENT.baseItems.map((item) =>
        item.key === 'heaven-sword' ? { ...item, attributes: ['crit-chance'] } : item,
      ),
    });
    const rolled = Array.from({ length: 50 }, (_, n) => {
      const made = restricted.createBase({ ...context, baseKey: 'heaven-sword', n });
      if (!made.ok) throw new Error(made.refusal.code);
      return made.value.attributes.map((entry) => entry.key);
    });
    expect(rolled.flat().every((key) => key === 'crit-chance')).toBe(true);
    expect(rolled.flat().length).toBeGreaterThan(0);
    expect(
      restricted.createBase(
        { ...context, baseKey: 'heaven-sword' },
        {
          attributes: [{ key: 'will', value: 1 }],
        },
      ).ok,
    ).toBe(false);
  });

  it('keeps the authored layer, skills and price of a unique and respects source scope', () => {
    const definition = TOKEN_UNIQUES.find((entry) => entry.key === 'lantern-eater')!;
    const uniqueContext = { ...context, dimension: EDimension.UNDERWORLD };
    for (let n = 0; n < 10; n++) {
      const made = factory.createUnique(definition.key, { ...uniqueContext, n });
      if (!made.ok) throw new Error(made.refusal.code);
      for (const { attribute, min, max } of definition.authoredAttributes) {
        const rolled = made.value.attributes.find((entry) => entry.key === attribute);
        expect(rolled?.value).toBeGreaterThanOrEqual(min);
        expect(rolled?.value).toBeLessThanOrEqual(max);
      }
      expect(made.value.skills).toEqual(definition.skills);
      expect(made.value.price).toBe(definition.price);
    }
    expect(
      factory.createUnique(definition.key, { ...uniqueContext, dimension: EDimension.HEAVEN }).ok,
    ).toBe(false);
  });
});

describe('stored base identity migration', () => {
  it('adds a concrete identity to a v5 token without changing any rolled fields', () => {
    const made = baseToken('heaven-sword');
    const old: Record<string, unknown> = { ...made, generatorVersion: 5 };
    delete old.baseKey;
    const loaded = itemTokenSchema.parse(old);
    expect(loaded).toEqual({ ...old, baseKey: 'heaven-sword' });
    expect(itemTokenSchema.parse(loaded)).toEqual(loaded);
  });
});

describe('shared and private loot availability', () => {
  it('allows coins, scrolls and potions everywhere without changing their ownership', () => {
    for (const dimension of Object.values(EDimension)) {
      for (const itemKey of ['coins', 'return-scroll', 'health-bottle'] as const)
        expect(dropAvailableIn({ itemKey }, dimension)).toBe(true);
    }
    expect(availableInDimension({ dimension: EDimension.EARTH }, EDimension.HEAVEN)).toBe(false);
  });

  const table: LootTable = {
    id: 'mixed',
    rolls: [2, 2],
    entries: [
      { itemKey: 'sword', baseKey: 'earth-sword', weight: 100, amount: [1, 1] },
      { itemKey: 'sword', baseKey: 'heaven-sword', weight: 1, amount: [1, 1] },
      { itemKey: 'return-scroll', weight: 1, amount: [1, 1] },
    ],
  };

  it('filters weighted entries before the roll, including an explicitly named foreign base', () => {
    for (let n = 0; n < 100; n++) {
      const drops = rollLoot(
        table,
        createSeededRandom({ seed: String(n), counter: 0 }),
        EDimension.HEAVEN,
      );
      expect(drops).toHaveLength(2);
      expect(drops.every((drop) => drop.baseKey !== 'earth-sword')).toBe(true);
    }
  });

  it('refuses illegal guaranteed entries and empty required pools before RNG', () => {
    const rng = vi.fn(() => 0);
    expect(() =>
      rollLoot({ ...table, guaranteed: [table.entries[0]] }, rng, EDimension.HEAVEN),
    ).toThrow('GUARANTEED_DROP_OUTSIDE_DIMENSION');
    expect(() =>
      rollLoot({ ...table, entries: [table.entries[0]] }, rng, EDimension.HEAVEN),
    ).toThrow('EMPTY_DIMENSION_LOOT_POOL');
    expect(rng).not.toHaveBeenCalled();
  });

  it('container acquisition mints the selected concrete base in the trusted source dimension', () => {
    const container = createContainer({
      id: 'c',
      kind: 'chest',
      at: { q: 0, r: 0 },
      tables: [table],
      seed: 'scope',
      sourceId: 'scope',
      targetKey: '0,0',
      dropContext: { tokenType: ETokenType.SPARK, mapTier: 1 },
    });
    for (const drop of container.contents!.flat()) {
      expect(drop.baseKey).not.toBe('earth-sword');
      if (drop.token)
        expect(drop.token).toMatchObject({ baseKey: 'heaven-sword', dimension: 'heaven' });
    }
  });
});
