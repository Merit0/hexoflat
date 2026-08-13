import { describe, expect, it } from 'vitest';
import { HexMapBuilder } from '../map/builders/hex-map-builder';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { coordinateKey, hexDistance } from '../utils/hex-utils';
import { findAttackOptions, findAutoDefendCoords, findRetreatOptions } from './ai-controller';
import type { EnemyMoveOption } from './ai-controller';

function buildRevealedMap(width = 7, height = 7) {
  const map = new HexMapBuilder().name('enemy-ai').width(width).height(height).build();
  for (const tile of map.tiles) tile.isRevealed = true;
  return map;
}

function placeAt(
  map: ReturnType<typeof buildRevealedMap>,
  coord: { columnIndex: number; rowIndex: number },
  key: string,
) {
  const tile = map.tiles.find((t) => coordinateKey(t.coordinates) === coordinateKey(coord))!;
  tile.hexobject = HexObjectFactory.create(key as never, coord);
}

const hero = { columnIndex: 3, rowIndex: 3 };

describe('findAttackOptions', () => {
  it('offers an empty route when the enemy already stands next to the hero', () => {
    const map = buildRevealedMap();
    const enemy = { columnIndex: 3, rowIndex: 2 };

    const options = findAttackOptions(map, enemy, hero, 5);
    const standingPut = options.find(
      (o: EnemyMoveOption) => coordinateKey(o.coord) === coordinateKey(enemy),
    )!;

    expect(standingPut).toBeDefined();
    expect(standingPut.route).toEqual([]);
  });

  it('only offers tiles adjacent to the hero', () => {
    const map = buildRevealedMap();

    const options = findAttackOptions(map, { columnIndex: 0, rowIndex: 0 }, hero, 10);

    for (const option of options) {
      expect(hexDistance(option.coord, hero)).toBe(1);
    }
  });

  it('offers nothing when the step budget cannot reach the hero', () => {
    const map = buildRevealedMap();

    expect(findAttackOptions(map, { columnIndex: 0, rowIndex: 0 }, hero, 1)).toEqual([]);
  });

  it('skips solid tiles', () => {
    const map = buildRevealedMap();
    const blocked = { columnIndex: 3, rowIndex: 2 };
    placeAt(map, blocked, HEXOBJECT_KEYS.ROCK);

    const options = findAttackOptions(map, { columnIndex: 0, rowIndex: 0 }, hero, 10);

    expect(
      options.some((o: EnemyMoveOption) => coordinateKey(o.coord) === coordinateKey(blocked)),
    ).toBe(false);
  });

  it('skips tiles the enemy cannot see', () => {
    const map = buildRevealedMap();
    const hidden = { columnIndex: 3, rowIndex: 2 };
    map.tiles.find((t) => coordinateKey(t.coordinates) === coordinateKey(hidden))!.isRevealed =
      false;

    const options = findAttackOptions(map, { columnIndex: 0, rowIndex: 0 }, hero, 10);

    expect(
      options.some((o: EnemyMoveOption) => coordinateKey(o.coord) === coordinateKey(hidden)),
    ).toBe(false);
  });
});

describe('findRetreatOptions', () => {
  it('only offers tiles out of the hero’s reach', () => {
    const map = buildRevealedMap();

    const options = findRetreatOptions(map, { columnIndex: 3, rowIndex: 2 }, hero, 10);

    expect(options.length).toBeGreaterThan(0);
    for (const option of options) {
      expect(hexDistance(option.coord, hero)).toBeGreaterThan(1);
    }
  });

  it('never offers the tile the enemy already occupies', () => {
    const map = buildRevealedMap();
    const enemy = { columnIndex: 5, rowIndex: 5 };

    const options = findRetreatOptions(map, enemy, hero, 10);

    expect(
      options.some((o: EnemyMoveOption) => coordinateKey(o.coord) === coordinateKey(enemy)),
    ).toBe(false);
  });

  it('offers nothing with no steps left', () => {
    const map = buildRevealedMap();

    expect(findRetreatOptions(map, { columnIndex: 3, rowIndex: 2 }, hero, 0)).toEqual([]);
  });
});

describe('findAutoDefendCoords', () => {
  it('offers the tiles around the enemy', () => {
    const map = buildRevealedMap();

    const coords = findAutoDefendCoords(map, { columnIndex: 3, rowIndex: 3 });

    expect(coords).toHaveLength(6);
  });

  it('drops neighbours that fall off the map', () => {
    const map = buildRevealedMap();

    expect(findAutoDefendCoords(map, { columnIndex: 0, rowIndex: 0 }).length).toBeLessThan(6);
  });
});
