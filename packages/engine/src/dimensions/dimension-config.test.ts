import { describe, expect, it } from 'vitest';
import { ERarityKind } from '../abstraction/hexobject-abstraction';
import { RARITY_TONES, RARITY_TONE_LIGHTS, rarityTone } from '../content/rarity-rules';
import { TOKEN_PRICE_RANGES } from '../content/token-prices.content';
import { LIGHT_COLOR_BY_TONE, LIGHT_TONES } from '../tokens/light-tone';
import { BASE_REALMS, TOKEN_ORIGINS } from '../tokens/token-keys';
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
};

function recordWith(change: Record<string, unknown>) {
  return { ...structuredClone(DIMENSIONS), ...change };
}

describe('DA3a-4: the dimension record is complete', () => {
  it.each(Object.values(EDimension))('%s has a token type and at least one tier', (dimension) => {
    expect(Object.values(ERarityKind)).toContain(DIMENSIONS[dimension].tokenType);
    expect(tiersOfDimension(dimension).length).toBeGreaterThan(0);
  });

  it.each(DIMENSION_TIERS.map((view) => [view.dimension, view.tier, view] as const))(
    '%s %s has a light and a price',
    (_dimension, tier, view) => {
      expect(view.light.id).toMatch(/^[a-z]+$/);
      expect(view.light.color).toMatch(/^#[0-9A-F]{6}$/);
      if (tier === 'base') {
        expect(view.price.kind).toBe('range');
      } else {
        expect(view.price).toEqual({ kind: 'manual' });
      }
    },
  );

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
      recordWith({ [EDimension.HEAVEN]: { tokenType: ERarityKind.SPARK, tiers: {} } }),
    ],
    [
      'a tier without a light',
      recordWith({
        [EDimension.HEAVEN]: {
          tokenType: ERarityKind.SPARK,
          tiers: { base: { price: VALID_TIER.price } },
        },
      }),
    ],
    [
      'a base tier priced manually',
      recordWith({
        [EDimension.HEAVEN]: {
          tokenType: ERarityKind.SPARK,
          tiers: { base: { ...VALID_TIER, price: { kind: 'manual' } } },
        },
      }),
    ],
    [
      'a range with min above max',
      recordWith({
        [EDimension.HEAVEN]: {
          tokenType: ERarityKind.SPARK,
          tiers: { base: { ...VALID_TIER, price: { kind: 'range', range: [9, 1] } } },
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
    expect(BASE_REALMS).toEqual(['gloom', 'idol', 'spark']);
    expect(TOKEN_ORIGINS).toEqual(['base', 'unique']);
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

  it('rarity tones, their colours and the alien tone for any boss flag', () => {
    expect(RARITY_TONES).toEqual([
      'gloom',
      'gloom-boss',
      'idol',
      'idol-boss',
      'spark',
      'spark-boss',
      'alien',
    ]);
    expect(
      Object.fromEntries(RARITY_TONES.map((tone) => [tone, RARITY_TONE_LIGHTS[tone].color])),
    ).toEqual({
      gloom: '#3E8BFF',
      'gloom-boss': '#A855F7',
      idol: '#A9AEB4',
      'idol-boss': '#4FD27A',
      spark: '#F5D33B',
      'spark-boss': '#FF8A2A',
      alien: '#FF3B3B',
    });
    expect(rarityTone({ kind: ERarityKind.ALIEN, boss: false })).toBe('alien');
    expect(rarityTone({ kind: ERarityKind.ALIEN, boss: true })).toBe('alien');
  });

  it('base price ranges', () => {
    expect(TOKEN_PRICE_RANGES).toEqual({
      gloom: [60, 800],
      idol: [40, 600],
      spark: [100, 1200],
    });
  });
});
