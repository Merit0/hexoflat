import { describe, expect, it } from 'vitest';
import { ETokenType } from '../abstraction/hexobject-abstraction';
import { LIGHT_NAMES, LIGHTS_BY_NAME, lightNameOf } from '../content/token-type-rules';
import { TOKEN_PRICE_RANGES } from '../content/token-prices.content';
import { TONE_SORT_ORDER } from '../inventory/item-queries';
import { LIGHT_COLOR_BY_TONE, LIGHT_TONES } from '../tokens/light-tone';
import { BASE_TOKEN_TYPES } from '../tokens/token-keys';
import {
  DIMENSIONS,
  DIMENSION_TIERS,
  dimensionAllowsTier,
  dimensionConfigRecordSchema,
  EDimension,
  TOKEN_TIERS,
  tiersOfDimension,
} from './dimensions';

const VALID_TIER = {
  light: { id: 'white', color: '#FFFFFF' },
  price: { kind: 'range', range: [1, 2] },
  sortRank: 99,
};

function recordWith(change: Record<string, unknown>) {
  return { ...structuredClone(DIMENSIONS), ...change };
}

describe('DA3a-4: the dimension record is complete', () => {
  it.each(Object.values(EDimension))('%s has a token type and at least one tier', (dimension) => {
    expect(Object.values(ETokenType)).toContain(DIMENSIONS[dimension].tokenType);
    expect(tiersOfDimension(dimension).length).toBeGreaterThan(0);
  });

  it.each(DIMENSION_TIERS.map((view) => [view.dimension, view.tier, view] as const))(
    '%s %s has a light, a price rule (base = range, unique = manual) and a sort rank',
    (_dimension, tier, view) => {
      expect(view.light.id).toMatch(/^[a-z]+$/);
      expect(view.light.color).toMatch(/^#[0-9A-F]{6}$/);
      if (tier === 'base') {
        expect(view.price.kind).toBe('range');
      } else {
        expect(view.price).toEqual({ kind: 'manual' });
      }
      expect(Number.isInteger(view.sortRank)).toBe(true);
      expect(view.sortRank).toBeGreaterThanOrEqual(0);
    },
  );

  it('every tier has its own sort rank', () => {
    const ranks = DIMENSION_TIERS.map((view) => view.sortRank);
    expect(new Set(ranks).size).toBe(ranks.length);
  });

  it('Alien (Nowhere) is unique only; the other dimensions have base and unique', () => {
    expect(tiersOfDimension(EDimension.NOWHERE)).toEqual(['unique']);
    for (const dimension of [EDimension.HEAVEN, EDimension.EARTH, EDimension.UNDERWORLD]) {
      expect(tiersOfDimension(dimension)).toEqual([...TOKEN_TIERS]);
    }
    expect(dimensionAllowsTier(EDimension.NOWHERE, 'base')).toBe(false);
  });

  it('the record itself passes its schema', () => {
    expect(dimensionConfigRecordSchema.safeParse(DIMENSIONS).success).toBe(true);
  });

  it.each([
    ['a missing dimension', { ...structuredClone(DIMENSIONS), [EDimension.HEAVEN]: undefined }],
    [
      'a dimension without tiers',
      recordWith({ [EDimension.HEAVEN]: { tokenType: ETokenType.SPARK, tiers: {} } }),
    ],
    [
      'a tier without a light',
      recordWith({
        [EDimension.HEAVEN]: {
          tokenType: ETokenType.SPARK,
          tiers: { base: { price: VALID_TIER.price } },
        },
      }),
    ],
    [
      'a base tier priced manually',
      recordWith({
        [EDimension.HEAVEN]: {
          tokenType: ETokenType.SPARK,
          tiers: { base: { ...VALID_TIER, price: { kind: 'manual' } } },
        },
      }),
    ],
    [
      'a range with min above max',
      recordWith({
        [EDimension.HEAVEN]: {
          tokenType: ETokenType.SPARK,
          tiers: { base: { ...VALID_TIER, price: { kind: 'range', range: [9, 1] } } },
        },
      }),
    ],
    [
      'a tier without a sort rank',
      recordWith({
        [EDimension.HEAVEN]: {
          tokenType: ETokenType.SPARK,
          tiers: { base: { light: VALID_TIER.light, price: VALID_TIER.price } },
        },
      }),
    ],
    [
      'a unique tier priced by a range',
      recordWith({
        [EDimension.NOWHERE]: { tokenType: ETokenType.ALIEN, tiers: { unique: VALID_TIER } },
      }),
    ],
    [
      'two tiers with one sort rank',
      recordWith({
        [EDimension.NOWHERE]: {
          tokenType: ETokenType.ALIEN,
          tiers: {
            unique: {
              light: { id: 'white', color: '#FFFFFF' },
              price: { kind: 'manual' },
              sortRank: 1,
            },
          },
        },
      }),
    ],
    [
      'one token type in two dimensions',
      recordWith({
        [EDimension.HEAVEN]: { ...structuredClone(DIMENSIONS[EDimension.EARTH]) },
      }),
    ],
    [
      'an unknown tier',
      recordWith({ [EDimension.NOWHERE]: { tokenType: 'alien', tiers: { epic: VALID_TIER } } }),
    ],
  ])('the schema refuses %s', (_name, record) => {
    expect(dimensionConfigRecordSchema.safeParse(record).success).toBe(false);
  });
});

describe('DA3a: derived views keep the values and order they had before', () => {
  it('base token types', () => {
    expect(BASE_TOKEN_TYPES).toEqual(['gloom', 'idol', 'spark']);
    expect(TOKEN_TIERS).toEqual(['base', 'unique']);
  });

  it('light tones and their lights', () => {
    expect(LIGHT_TONES).toEqual([
      'gloom-base',
      'gloom-unique',
      'idol-base',
      'idol-unique',
      'spark-base',
      'spark-unique',
      'alien-unique',
    ]);
    expect(LIGHT_COLOR_BY_TONE).toEqual({
      'gloom-base': 'blue',
      'gloom-unique': 'violet',
      'idol-base': 'gray',
      'idol-unique': 'green',
      'spark-base': 'yellow',
      'spark-unique': 'orange',
      'alien-unique': 'red',
    });
  });

  it('tokenType tones, their colours and the alien tone for any boss flag', () => {
    expect(LIGHT_NAMES).toEqual([
      'gloom',
      'gloom-boss',
      'idol',
      'idol-boss',
      'spark',
      'spark-boss',
      'alien',
    ]);
    expect(
      Object.fromEntries(LIGHT_NAMES.map((tone) => [tone, LIGHTS_BY_NAME[tone].color])),
    ).toEqual({
      gloom: '#3E8BFF',
      'gloom-boss': '#A855F7',
      idol: '#A9AEB4',
      'idol-boss': '#4FD27A',
      spark: '#F5D33B',
      'spark-boss': '#FF8A2A',
      alien: '#FF3B3B',
    });
    expect(lightNameOf({ kind: ETokenType.ALIEN, boss: false })).toBe('alien');
    expect(lightNameOf({ kind: ETokenType.ALIEN, boss: true })).toBe('alien');
  });

  it('the inventory sort order of tokenType tones', () => {
    expect(TONE_SORT_ORDER).toEqual([
      'alien',
      'spark-boss',
      'gloom-boss',
      'idol-boss',
      'spark',
      'gloom',
      'idol',
    ]);
  });

  it('base price ranges', () => {
    expect(TOKEN_PRICE_RANGES).toEqual({
      gloom: [60, 800],
      idol: [40, 600],
      spark: [100, 1200],
    });
  });
});
