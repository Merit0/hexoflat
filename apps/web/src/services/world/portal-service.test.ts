import { describe, expect, it, vi } from 'vitest';
import { HexMapBuilder } from '@hexoflat/engine/map/builders/hex-map-builder';
import { HexObjectFactory } from '@hexoflat/engine/factory/hex-object-factory';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { hexDistance } from '@hexoflat/engine/utils/hex-utils';
import { applyPortalRemovals, findPortalSpot, placeReturnPortal } from './portal-service';

function buildMap() {
  return new HexMapBuilder().name('portal').width(5).height(5).build();
}

describe('portal-service', () => {
  it('returns the wanted hex when it is free ground', () => {
    const map = buildMap();
    const wanted = map.tiles[12].coordinates;

    expect(findPortalSpot(map, wanted)).toEqual(wanted);
  });

  it('falls back to the nearest free ground hex when the wanted one is taken', () => {
    const map = buildMap();
    const wanted = map.tiles[12].coordinates;
    map.tiles[12].hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.COINS, wanted);

    const spot = findPortalSpot(map, wanted)!;

    expect(hexDistance(spot, wanted)).toBe(1);
  });

  it('skips hexes in the occupied list', () => {
    const map = buildMap();
    const wanted = map.tiles[12].coordinates;

    expect(findPortalSpot(map, wanted, [wanted])).not.toEqual(wanted);
  });

  it('removes only return-portal objects from the current map and stored maps', () => {
    const map = buildMap();
    const portalHex = map.tiles[3].coordinates;
    const coinHex = map.tiles[4].coordinates;
    placeReturnPortal(map, portalHex);
    map.tiles[4].hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.COINS, coinHex);
    const updateStoredMap = vi.fn(() => true);
    const markTileDirty = vi.fn();

    const result = applyPortalRemovals(
      [
        {
          heroId: 'h',
          reason: 'OTHER_GATE',
          remove: [
            { locationKey: 'silesia', mapId: 'm1', hex: portalHex },
            { locationKey: 'silesia', mapId: 'm1', hex: coinHex },
            { locationKey: 'camping', mapId: null, hex: portalHex },
          ],
        },
      ],
      {
        currentLocationKey: 'silesia',
        currentMapId: 'm1',
        map,
        storedMapId: () => 'camp-map',
        updateStoredMap,
        markTileDirty,
      },
    );

    expect(result.touchedCurrent).toBe(true);
    expect(map.tiles[3].hexobject).toBeNull();
    expect(map.tiles[4].hexobject?.hexobjectKey).toBe(HEXOBJECT_KEYS.COINS);
    expect(updateStoredMap).toHaveBeenCalledTimes(1);
    expect(updateStoredMap).toHaveBeenCalledWith('camp-map', expect.any(Function));
  });
});
