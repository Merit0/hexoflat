import { describe, expect, it } from 'vitest';
import { HexMapBuilder } from '../map/builders/hex-map-builder';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { coordinateKey } from '../utils/hex-utils';
import {
  canAttackTarget,
  canPlaceDefendMarkerOn,
  findEnemyTiles,
  findEnemyTilesSeeingHero,
  hasLivingEnemies,
  isAdjacentTo,
} from './combat-rules';

function buildRevealedMap(width = 7, height = 7) {
  const map = new HexMapBuilder().name('combat-rules').width(width).height(height).build();
  for (const tile of map.tiles) tile.isRevealed = true;
  return map;
}

function tileAt(
  map: ReturnType<typeof buildRevealedMap>,
  coord: { columnIndex: number; rowIndex: number },
) {
  return map.tiles.find((t) => coordinateKey(t.coordinates) === coordinateKey(coord))!;
}

function placeEnemy(
  map: ReturnType<typeof buildRevealedMap>,
  coord: { columnIndex: number; rowIndex: number },
) {
  const tile = tileAt(map, coord);
  tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.SKELETOR, coord);
  return tile;
}

const hero = { columnIndex: 3, rowIndex: 3 };

describe('hasLivingEnemies', () => {
  it('is false on a map with no creatures', () => {
    expect(hasLivingEnemies(buildRevealedMap())).toBe(false);
  });

  it('is true while an enemy remains', () => {
    const map = buildRevealedMap();
    placeEnemy(map, { columnIndex: 1, rowIndex: 1 });

    expect(hasLivingEnemies(map)).toBe(true);
  });
});

describe('findEnemyTiles', () => {
  it('orders enemies by distance from the hero, nearest first', () => {
    const map = buildRevealedMap();
    placeEnemy(map, { columnIndex: 6, rowIndex: 6 });
    const near = placeEnemy(map, { columnIndex: 3, rowIndex: 2 });

    expect(findEnemyTiles(map, hero)[0]).toBe(near);
  });

  it('returns nothing when no enemy is on the map', () => {
    expect(findEnemyTiles(buildRevealedMap(), hero)).toEqual([]);
  });
});

describe('findEnemyTilesSeeingHero', () => {
  it('includes an enemy standing next to the hero', () => {
    const map = buildRevealedMap();
    placeEnemy(map, { columnIndex: 3, rowIndex: 2 });

    expect(findEnemyTilesSeeingHero(map, hero)).toHaveLength(1);
  });

  it('excludes an enemy beyond its vision range', () => {
    const map = buildRevealedMap(15, 15);
    placeEnemy(map, { columnIndex: 14, rowIndex: 14 });

    expect(findEnemyTilesSeeingHero(map, hero)).toEqual([]);
  });
});

describe('isAdjacentTo', () => {
  it('is true for a direct neighbour', () => {
    expect(isAdjacentTo(hero, { columnIndex: 3, rowIndex: 2 })).toBe(true);
  });

  it('is false for the tile itself', () => {
    expect(isAdjacentTo(hero, hero)).toBe(false);
  });

  it('is false for a distant tile', () => {
    expect(isAdjacentTo(hero, { columnIndex: 0, rowIndex: 0 })).toBe(false);
  });
});

describe('canPlaceDefendMarkerOn', () => {
  it('accepts an adjacent, revealed, empty tile', () => {
    expect(canPlaceDefendMarkerOn(buildRevealedMap(), hero, { columnIndex: 3, rowIndex: 2 })).toBe(
      true,
    );
  });

  it('rejects a tile that is not adjacent', () => {
    expect(canPlaceDefendMarkerOn(buildRevealedMap(), hero, { columnIndex: 0, rowIndex: 0 })).toBe(
      false,
    );
  });

  it('rejects an occupied tile — a marker there would block nothing', () => {
    const map = buildRevealedMap();
    const occupied = { columnIndex: 3, rowIndex: 2 };
    placeEnemy(map, occupied);

    expect(canPlaceDefendMarkerOn(map, hero, occupied)).toBe(false);
  });

  it('rejects an unrevealed tile', () => {
    const map = buildRevealedMap();
    const hidden = { columnIndex: 3, rowIndex: 2 };
    tileAt(map, hidden).isRevealed = false;

    expect(canPlaceDefendMarkerOn(map, hero, hidden)).toBe(false);
  });
});

describe('canAttackTarget', () => {
  it('accepts an adjacent enemy', () => {
    const map = buildRevealedMap();
    const enemy = placeEnemy(map, { columnIndex: 3, rowIndex: 2 });

    expect(canAttackTarget(hero, enemy)).toBe(true);
  });

  it('rejects an enemy that is out of reach', () => {
    const map = buildRevealedMap();
    const enemy = placeEnemy(map, { columnIndex: 6, rowIndex: 6 });

    expect(canAttackTarget(hero, enemy)).toBe(false);
  });

  it('rejects an adjacent tile that holds no creature', () => {
    const map = buildRevealedMap();

    expect(canAttackTarget(hero, tileAt(map, { columnIndex: 3, rowIndex: 2 }))).toBe(false);
  });
});
