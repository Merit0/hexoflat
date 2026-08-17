import { describe, expect, it } from 'vitest';
import { HexMapBuilder } from '../builders/hex-map-builder';
import { HexTileModel } from './hex-tile-model';
import HexMapModel from './hex-map-model';

/**
 * The `coordinateKey -> tile` index added in E0. `tile-lookup.characterization.test.ts`
 * pins what the old linear scan answered; this file pins that `getTileAt`
 * answers the same, and that its cache invalidates when it must.
 */

function buildMap(width = 3, height = 3): HexMapModel {
  return new HexMapBuilder().name('tile-index').width(width).height(height).build();
}

function makeTile(columnIndex: number, rowIndex: number): HexTileModel {
  const tile = new HexTileModel();
  tile.coordinates = { columnIndex, rowIndex };
  return tile;
}

describe('HexMapModel.getTileAt', () => {
  it('returns the same tile object the linear scan would have found', () => {
    const map = buildMap();

    for (const tile of map.tiles) {
      expect(map.getTileAt(tile.coordinates)).toBe(tile);
    }
  });

  it('returns null for coordinates the map does not have', () => {
    const map = buildMap();

    expect(map.getTileAt({ columnIndex: 99, rowIndex: 99 })).toBeNull();
    expect(map.getTileAt({ columnIndex: -1, rowIndex: 0 })).toBeNull();
  });

  it('resolves duplicate coordinates to the first tile, like Array.find did', () => {
    const map = buildMap();
    const first = map.tiles[0];
    map.tiles.push(makeTile(0, 0));

    expect(map.getTileAt({ columnIndex: 0, rowIndex: 0 })).toBe(first);
  });

  it('sees a tile pushed onto the existing tiles array after the index was built', () => {
    const map = buildMap();
    expect(map.getTileAt({ columnIndex: 50, rowIndex: 50 })).toBeNull();

    const extra = makeTile(50, 50);
    map.tiles.push(extra);

    expect(map.getTileAt({ columnIndex: 50, rowIndex: 50 })).toBe(extra);
  });

  it('sees a wholesale replacement of the tiles array', () => {
    const map = buildMap();
    expect(map.getTileAt({ columnIndex: 0, rowIndex: 0 })).not.toBeNull();

    const replacement = makeTile(7, 7);
    map.tiles = [replacement];

    expect(map.getTileAt({ columnIndex: 7, rowIndex: 7 })).toBe(replacement);
    expect(map.getTileAt({ columnIndex: 0, rowIndex: 0 })).toBeNull();
  });

  it('picks up an in-place coordinate reassignment once the index is invalidated', () => {
    const map = buildMap();
    const tile = map.tiles[0];
    map.getTileAt(tile.coordinates);

    tile.coordinates = { columnIndex: 42, rowIndex: 42 };
    map.invalidateTileIndex();

    expect(map.getTileAt({ columnIndex: 42, rowIndex: 42 })).toBe(tile);
    expect(map.getTileAt({ columnIndex: 0, rowIndex: 0 })).toBeNull();
  });

  it('survives a serialize/deserialize round trip', () => {
    const map = buildMap();
    const restored = HexMapModel.fromJSON(map.toJSON(), 0);

    for (const tile of map.tiles) {
      expect(restored.getTileAt(tile.coordinates)?.coordinates).toEqual(tile.coordinates);
    }
    expect(restored.getTileAt({ columnIndex: 99, rowIndex: 99 })).toBeNull();
  });

  it('answers repeated lookups without rebuilding the index', () => {
    const map = buildMap(20, 20);
    const probe = { columnIndex: 19, rowIndex: 19 };

    // Same tile every time, and no accumulation of state that would make a
    // later call disagree with the first.
    const answers = new Set(Array.from({ length: 50 }, () => map.getTileAt(probe)));

    expect(answers.size).toBe(1);
    expect([...answers][0]).not.toBeNull();
  });
});
