import { describe, expect, it } from 'vitest';
import { HexMapBuilder } from '@hexoflat/engine/map/builders/hex-map-builder';
import { HexObjectFactory } from '@hexoflat/engine/factory/hex-object-factory';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { hexDistance } from '@hexoflat/engine/utils/hex-utils';
import { findPortalSpot } from './portal-service';

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
});
