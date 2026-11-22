import { describe, expect, it } from 'vitest';
import { dimensionSchema, EDimension, itemFamilyOfDimension } from './dimensions';
import { realmOfBoard, tokenOriginOfBoard } from '../registry/location-token-origin';
import { MapRegistry } from '../registry/world-map-registry';
import { LOCATION_KEYS } from '../registry/location-key';

describe('dimension ownership', () => {
  it.each([
    [EDimension.HEAVEN, 'spark'],
    [EDimension.EARTH, 'idol'],
    [EDimension.UNDERWORLD, 'gloom'],
    [EDimension.NOWHERE, 'alient'],
  ] as const)('%s owns the %s item family', (dimension, family) => {
    expect(itemFamilyOfDimension(dimension)).toBe(family);
  });

  it.each([undefined, null, 'unknown', [], ['earth', 'heaven']])(
    'rejects missing, unknown and multiple owners: %j',
    (value) => {
      expect(dimensionSchema.safeParse(value).success).toBe(false);
      expect(() => itemFamilyOfDimension(value as EDimension)).toThrow();
    },
  );

  it('uses explicit ownership even when board construction suggests another realm', () => {
    const earthDungeon = { boardKind: 'DUNGEON', dimension: EDimension.EARTH };
    const underworldStatic = { boardKind: 'STATIC', dimension: EDimension.UNDERWORLD };
    expect(tokenOriginOfBoard(earthDungeon, null)).toEqual({ realm: 'idol', mapTier: 1 });
    expect(tokenOriginOfBoard(underworldStatic, null)).toEqual({ realm: 'gloom', mapTier: 1 });
    expect(realmOfBoard({ dimension: EDimension.HEAVEN })).toBe('spark');
  });

  it('does not fall back to EARTH when ownership is absent or NOWHERE is used for base loot', () => {
    expect(() => realmOfBoard({} as { dimension: EDimension })).toThrow();
    expect(() => realmOfBoard({ dimension: EDimension.NOWHERE })).toThrow();
  });

  it('assigns every registered location explicitly', () => {
    expect(
      Object.fromEntries(LOCATION_KEYS.map((key) => [key, MapRegistry.get(key).dimension])),
    ).toEqual({ camping: 'earth', silesia: 'earth', 'silesia-north': 'earth', cave: 'underworld' });
  });
});
