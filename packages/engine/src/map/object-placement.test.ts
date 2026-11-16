import { describe, expect, it } from 'vitest';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { deriveStream } from '../utils/random-seeded';
import HexMapModel from './models/hex-map-model';
import { HexTileModel } from './models/hex-tile-model';
import { placeMapObject, planObjectPlacement } from './object-placement';

function mapOf() {
  const map = new HexMapModel();
  map.tiles = Array.from({ length: 4 }, (_, columnIndex) => {
    const tile = new HexTileModel();
    tile.coordinates = { columnIndex, rowIndex: 0 };
    tile.isRevealed = columnIndex % 2 === 0;
    return tile;
  });
  return map;
}

describe('map object placement', () => {
  it('chooses deterministically independent of tile order and preserves fog', () => {
    const first = mapOf();
    const second = mapOf();
    second.tiles.reverse();
    const fog = first.tiles.map((tile) => tile.isRevealed);
    const request = () => ({
      strategy: 'random-empty' as const,
      random: deriveStream('seed', 'token'),
    });
    const a = placeMapObject(first, HEXOBJECT_KEYS.TREASURE_MAP, request());
    const b = placeMapObject(second, HEXOBJECT_KEYS.TREASURE_MAP, request());
    expect(a.ok).toBe(true);
    expect(b.ok && a.ok && b.coordinates).toEqual(a.ok && a.coordinates);
    expect(first.tiles.map((tile) => tile.isRevealed)).toEqual(fog);
  });

  it('requires an explicit matching replacement and leaves state intact on refusal', () => {
    const map = mapOf();
    const tile = map.tiles[0];
    tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.CAVE_ENTRANCE, tile.coordinates);
    const original = tile.hexobject;
    expect(
      placeMapObject(map, HEXOBJECT_KEYS.TREASURE_MAP, {
        strategy: 'empty',
        coordinates: tile.coordinates,
      }).ok,
    ).toBe(false);
    expect(
      placeMapObject(map, HEXOBJECT_KEYS.TREASURE_MAP, {
        strategy: 'replace',
        coordinates: tile.coordinates,
        expectedObjectKey: HEXOBJECT_KEYS.TREASURE_MAP,
      }),
    ).toEqual({ ok: false, reason: 'REPLACEMENT_MISMATCH' });
    expect(tile.hexobject).toBe(original);
    const replaced = placeMapObject(map, HEXOBJECT_KEYS.TREASURE_MAP, {
      strategy: 'replace',
      coordinates: tile.coordinates,
      expectedObjectKey: HEXOBJECT_KEYS.CAVE_ENTRANCE,
    });
    expect(replaced.ok).toBe(true);
    expect(tile.hexobject?.hexobjectKey).toBe(HEXOBJECT_KEYS.TREASURE_MAP);
  });

  it('refuses missing coordinates, occupied hero hexes, blocked terrain and reserved exits', () => {
    const map = mapOf();
    map.tiles[0].terrain = 'water';
    map.tiles[1].exit = 'N';
    const before = map.toJSON();
    const restrictions = {
      occupied: [map.tiles[2].coordinates],
      eligible: (tile: HexTileModel) => tile !== map.tiles[3],
    };
    expect(
      planObjectPlacement(map, { strategy: 'random-empty', random: () => 0 }, restrictions),
    ).toEqual({ ok: false, reason: 'NO_ELIGIBLE_HEX' });
    expect(
      planObjectPlacement(map, { strategy: 'empty', coordinates: { columnIndex: 50, rowIndex: 0 } })
        .ok,
    ).toBe(false);
    expect(map.toJSON()).toEqual(before);
  });

  it('protects pending actions and resource spawners even during explicit replacement', () => {
    const map = mapOf();
    const tile = map.tiles[0];
    tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.CAVE_ENTRANCE, tile.coordinates);
    tile.pendingAction = {} as NonNullable<typeof tile.pendingAction>;
    expect(
      placeMapObject(map, HEXOBJECT_KEYS.TREASURE_MAP, {
        strategy: 'replace',
        coordinates: tile.coordinates,
        expectedObjectKey: HEXOBJECT_KEYS.CAVE_ENTRANCE,
      }).ok,
    ).toBe(false);
    tile.pendingAction = null;
    tile.resourceSpawner = {} as NonNullable<typeof tile.resourceSpawner>;
    expect(
      placeMapObject(map, HEXOBJECT_KEYS.TREASURE_MAP, {
        strategy: 'replace',
        coordinates: tile.coordinates,
        expectedObjectKey: HEXOBJECT_KEYS.CAVE_ENTRANCE,
      }).ok,
    ).toBe(false);
  });
});
