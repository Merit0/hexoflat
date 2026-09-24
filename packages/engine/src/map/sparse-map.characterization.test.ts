import { describe, expect, it } from 'vitest';
import { HexMapBuilder } from './builders/hex-map-builder';
import { coordinateKey } from '../utils/hex-utils';
import { initFog, revealAroundHero } from './fog-service';
import { findFreeHexNear } from './free-hex-finder';
import { findShortestPath } from '../hero-movement/pathfinding-service';
import { buildTileIndex, getTraversableNeighbors } from '../hero-movement/movement-grid';

const VOID_COORD = { columnIndex: 2, rowIndex: 2 };

/**
 * C1's assembled boards (docs/WORLD-MAP-BOARDS-PLAN.md §3.5) carry tiles only
 * for non-void cells — `map.tiles.length` can be less than
 * `map.width * map.height`. This pins down that every piece of movement,
 * fog and lookup logic already treats a missing coordinate as "does not
 * exist" rather than assuming a dense width x height rectangle.
 */
function buildSparseMap() {
  const map = new HexMapBuilder().name('sparse').width(5).height(5).build();
  for (const tile of map.tiles) tile.isRevealed = true;
  map.tiles = map.tiles.filter(
    (tile) => coordinateKey(tile.coordinates) !== coordinateKey(VOID_COORD),
  );
  return map;
}

describe('sparse map characterization', () => {
  it('movement-grid never yields the void coordinate as a neighbour', () => {
    const map = buildSparseMap();
    const index = buildTileIndex(map);

    for (const neighborCoord of [
      { columnIndex: 1, rowIndex: 2 },
      { columnIndex: 3, rowIndex: 2 },
      { columnIndex: 2, rowIndex: 1 },
      { columnIndex: 2, rowIndex: 3 },
    ]) {
      const neighbours = getTraversableNeighbors(index, neighborCoord);
      expect(
        neighbours.some((n) => coordinateKey(n.coordinates) === coordinateKey(VOID_COORD)),
      ).toBe(false);
    }
  });

  it('findShortestPath routes around a void cell instead of through it', () => {
    const map = buildSparseMap();
    const start = { columnIndex: 0, rowIndex: 2 };
    const target = { columnIndex: 4, rowIndex: 2 };

    const path = findShortestPath(map, start, target);

    expect(path).not.toBeNull();
    expect(path?.some((coord) => coordinateKey(coord) === coordinateKey(VOID_COORD))).toBe(false);
  });

  it('revealAroundHero skips a void neighbour without throwing', () => {
    const map = buildSparseMap();
    for (const tile of map.tiles) tile.isRevealed = false;
    const heroCoord = { columnIndex: 1, rowIndex: 2 };

    const revealed = revealAroundHero(map, heroCoord);

    expect(revealed.some((coord) => coordinateKey(coord) === coordinateKey(VOID_COORD))).toBe(
      false,
    );
  });

  it('initFog only touches real tiles, not the full rectangle', () => {
    const map = buildSparseMap();

    const touched = initFog(map);

    expect(touched).toHaveLength(map.tiles.length);
    expect(touched.length).toBeLessThan(map.width * map.height);
  });

  it('findFreeHexNear skips a void neighbour without throwing', () => {
    const map = buildSparseMap();
    const near = { columnIndex: 1, rowIndex: 2 };

    const free = findFreeHexNear(map, near);

    expect(free).not.toBeNull();
    expect(coordinateKey(free as NonNullable<typeof free>)).not.toBe(coordinateKey(VOID_COORD));
  });
});
