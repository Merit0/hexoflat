import { describe, expect, it } from 'vitest';
import { HexMapBuilder } from './builders/hex-map-builder';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { coordinateKey } from '../utils/hex-utils';
import { findTilesMissingSpawners } from './resource-hydration';

function buildMap(width = 3, height = 3) {
  return new HexMapBuilder().name('hydration').width(width).height(height).build();
}

function configFor(coords: { columnIndex: number; rowIndex: number }[]) {
  return [
    { coordinates: coords, hexobject: { hexobjectKey: HEXOBJECT_KEYS.TREE } },
  ] as unknown as ReturnType<typeof buildMap>['config'];
}

describe('findTilesMissingSpawners', () => {
  it('returns nothing when the map declares no content', () => {
    const map = buildMap();
    map.config = [];

    expect(findTilesMissingSpawners(map)).toEqual([]);
  });

  it('reports a declared tile that has no spawner yet', () => {
    const map = buildMap();
    const coord = { columnIndex: 1, rowIndex: 1 };
    map.config = configFor([coord]);

    const missing = findTilesMissingSpawners(map);

    expect(missing).toHaveLength(1);
    expect(coordinateKey(missing[0].tile.coordinates)).toBe(coordinateKey(coord));
  });

  it('skips tiles that already carry a spawner, so hydration is re-runnable', () => {
    const map = buildMap();
    const coord = { columnIndex: 1, rowIndex: 1 };
    map.config = configFor([coord]);
    map.tiles.find((t) => coordinateKey(t.coordinates) === coordinateKey(coord))!.resourceSpawner =
      {} as never;

    expect(findTilesMissingSpawners(map)).toEqual([]);
  });

  it('ignores declared coordinates that are not on the map', () => {
    const map = buildMap();
    map.config = configFor([{ columnIndex: 99, rowIndex: 99 }]);

    expect(findTilesMissingSpawners(map)).toEqual([]);
  });

  it('ignores placements that declare no hexobject to spawn', () => {
    const map = buildMap();
    map.config = [{ coordinates: [{ columnIndex: 1, rowIndex: 1 }] }];

    expect(findTilesMissingSpawners(map)).toEqual([]);
  });
});
