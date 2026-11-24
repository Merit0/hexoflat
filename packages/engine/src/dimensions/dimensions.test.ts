import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  dimensionOfTokenType,
  dimensionSchema,
  DIMENSIONS,
  EDimension,
  tokenTypeOfDimension,
  type TTokenType,
} from './dimensions';
import { tokenTypeOfBoard, dropContextOfBoard } from '../registry/location-drop-context';
import { MapRegistry } from '../registry/world-map-registry';
import { LOCATION_KEYS } from '../registry/location-key';

describe('dimension ownership', () => {
  it.each([
    [EDimension.HEAVEN, 'spark'],
    [EDimension.EARTH, 'idol'],
    [EDimension.UNDERWORLD, 'gloom'],
    [EDimension.NOWHERE, 'alien'],
  ] as const)('%s owns the %s item family', (dimension, family) => {
    expect(tokenTypeOfDimension(dimension)).toBe(family);
  });

  it.each([undefined, null, 'unknown', [], ['earth', 'heaven']])(
    'rejects missing, unknown and multiple owners: %j',
    (value) => {
      expect(dimensionSchema.safeParse(value).success).toBe(false);
      expect(() => tokenTypeOfDimension(value as EDimension)).toThrow();
    },
  );

  it('uses explicit ownership even when board construction suggests another tokenType', () => {
    const earthDungeon = { boardKind: 'DUNGEON', dimension: EDimension.EARTH };
    const underworldStatic = { boardKind: 'STATIC', dimension: EDimension.UNDERWORLD };
    expect(dropContextOfBoard(earthDungeon, null)).toEqual({ tokenType: 'idol', mapTier: 1 });
    expect(dropContextOfBoard(underworldStatic, null)).toEqual({ tokenType: 'gloom', mapTier: 1 });
    expect(tokenTypeOfBoard({ dimension: EDimension.HEAVEN })).toBe('spark');
  });

  it('does not fall back to EARTH when ownership is absent or NOWHERE is used for base loot', () => {
    expect(() => tokenTypeOfBoard({} as { dimension: EDimension })).toThrow();
    expect(() => tokenTypeOfBoard({ dimension: EDimension.NOWHERE })).toThrow();
  });

  it('assigns every registered location explicitly', () => {
    expect(
      Object.fromEntries(LOCATION_KEYS.map((key) => [key, MapRegistry.get(key).dimension])),
    ).toEqual({ camping: 'earth', silesia: 'earth', 'silesia-north': 'earth', cave: 'underworld' });
  });
});

describe('DA8b: the dimension of a token type', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(Object.values(EDimension))('gives %s back from its token type', (dimension) => {
    expect(dimensionOfTokenType(DIMENSIONS[dimension].tokenType)).toBe(dimension);
  });

  it('refuses a token type that no dimension owns', () => {
    expect(() => dimensionOfTokenType('unknown' as TTokenType)).toThrow();
    vi.spyOn(Object, 'values').mockReturnValue([]);
    expect(() => dimensionOfTokenType(DIMENSIONS[EDimension.EARTH].tokenType)).toThrow(
      'Unknown token type: idol',
    );
  });
});
