import { describe, expect, it } from 'vitest';
import { HexMapBuilder } from './builders/hex-map-builder';
import { HexTileModel } from './models/hex-tile-model';
import HexMapModel from './models/hex-map-model';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { coordinateKey } from '../utils/hex-utils';
import { findFreeHexNear, findFreeHexNearObject } from './free-hex-finder';

/**
 * Characterization tests — written *before* the E0 `coordinateKey -> tile`
 * index landed on `HexMapModel`, and left untouched by it.
 *
 * Every lookup in the engine today is a linear `map.tiles.find(...)`. Swapping
 * that for a cached index is only safe if the index answers *exactly* the same
 * questions, including the awkward ones: tiles appended after the map was
 * built, tiles replaced wholesale, duplicate coordinates, and coordinates that
 * simply are not on the map. Those are the cases pinned here.
 */

function buildMap(width = 3, height = 3): HexMapModel {
  return new HexMapBuilder().name('lookup-characterization').width(width).height(height).build();
}

/** The linear scan every call site used before the index existed. */
function linearFind(map: HexMapModel, columnIndex: number, rowIndex: number) {
  return (
    map.tiles.find(
      (t) => t.coordinates.columnIndex === columnIndex && t.coordinates.rowIndex === rowIndex,
    ) ?? null
  );
}

function makeTile(columnIndex: number, rowIndex: number): HexTileModel {
  const tile = new HexTileModel();
  tile.coordinates = { columnIndex, rowIndex };
  return tile;
}

describe('tile lookup by coordinates (characterization)', () => {
  it('finds every generated tile, and the returned tile is the array element itself', () => {
    const map = buildMap();

    for (const tile of map.tiles) {
      const found = linearFind(map, tile.coordinates.columnIndex, tile.coordinates.rowIndex);

      expect(found).toBe(tile);
    }
  });

  it('generates exactly width * height tiles with unique coordinate keys', () => {
    const map = buildMap(4, 2);
    const keys = map.tiles.map((t) => coordinateKey(t.coordinates));

    expect(map.tiles).toHaveLength(8);
    expect(new Set(keys).size).toBe(8);
  });

  it('returns null for coordinates that are not on the map, including negatives', () => {
    const map = buildMap();

    expect(linearFind(map, 99, 99)).toBeNull();
    expect(linearFind(map, -1, 0)).toBeNull();
    expect(linearFind(map, 0, -1)).toBeNull();
  });

  it('sees a tile appended to the existing tiles array after the map was built', () => {
    const map = buildMap();
    const extra = makeTile(50, 50);

    expect(linearFind(map, 50, 50)).toBeNull();
    map.tiles.push(extra);

    expect(linearFind(map, 50, 50)).toBe(extra);
  });

  it('sees a wholesale replacement of the tiles array', () => {
    const map = buildMap();
    const replacement = makeTile(7, 7);

    map.tiles = [replacement];

    expect(linearFind(map, 7, 7)).toBe(replacement);
    expect(linearFind(map, 0, 0)).toBeNull();
  });

  it('sees a tile whose coordinates were reassigned in place', () => {
    const map = buildMap();
    const tile = map.tiles[0];

    tile.coordinates = { columnIndex: 42, rowIndex: 42 };

    expect(linearFind(map, 42, 42)).toBe(tile);
    expect(linearFind(map, 0, 0)).toBeNull();
  });

  it('resolves duplicate coordinates to the first tile in array order', () => {
    const map = buildMap();
    const duplicate = makeTile(0, 0);
    map.tiles.push(duplicate);

    expect(linearFind(map, 0, 0)).toBe(map.tiles[0]);
    expect(linearFind(map, 0, 0)).not.toBe(duplicate);
  });
});

describe('free-hex-finder lookups (characterization)', () => {
  it('returns a copy of the tile coordinates, not the tile’s own object', () => {
    const map = buildMap();

    const found = findFreeHexNear(map, { columnIndex: 1, rowIndex: 1 });

    expect(found).not.toBeNull();
    expect(found).not.toBe(map.tiles[0].coordinates);
  });

  it('without a generator, picks the first free neighbour in odd-q direction order', () => {
    const map = buildMap();

    expect(findFreeHexNear(map, { columnIndex: 1, rowIndex: 1 })).toEqual({
      columnIndex: 2,
      rowIndex: 2,
    });
  });

  it('skips neighbours blocked by a solid hexobject', () => {
    const map = buildMap();
    const blocker = linearFind(map, 2, 2)!;
    blocker.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.ROCK, blocker.coordinates);

    const found = findFreeHexNear(map, { columnIndex: 1, rowIndex: 1 });

    expect(found).not.toEqual({ columnIndex: 2, rowIndex: 2 });
    expect(linearFind(map, found!.columnIndex, found!.rowIndex)).not.toBeNull();
  });

  it('returns null when the coordinates have no neighbours on the map at all', () => {
    const map = buildMap();

    expect(findFreeHexNear(map, { columnIndex: 500, rowIndex: 500 })).toBeNull();
  });

  it('returns null when the map carries no such landmark', () => {
    const map = buildMap();

    expect(findFreeHexNearObject(map, HEXOBJECT_KEYS.TREE)).toBeNull();
  });

  it('finds a free hex beside the first tile carrying the landmark key', () => {
    const map = buildMap();
    const landmark = linearFind(map, 1, 1)!;
    landmark.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.TREE, landmark.coordinates);

    expect(findFreeHexNearObject(map, HEXOBJECT_KEYS.TREE)).toEqual({
      columnIndex: 2,
      rowIndex: 2,
    });
  });
});
