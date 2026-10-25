import { describe, expect, it } from 'vitest';
import { HexMapBuilder } from '../../map/builders/hex-map-builder';
import { HexObjectFactory } from '../../factory/hex-object-factory';
import { HEXOBJECT_KEYS } from '../../registry/hexobjects-registry';
import type { HexTileModel } from '../../map/models/hex-tile-model';
import { SpawnResourceFeature } from './spawn-resource-feature';

function mapWithDueSpawner() {
  const map = new HexMapBuilder().name('regrow').width(1).height(1).build();
  const tile = map.tiles[0];
  tile.hexobject = null;
  tile.resourceSpawner = {
    proto: { hexobjectKey: HEXOBJECT_KEYS.TREE },
    regrowMs: 1000,
    nextSpawnAt: 0,
    enabled: true,
  };
  return { map, tile };
}

function keyOn(tile: HexTileModel): string | undefined {
  return tile.hexobject?.hexobjectKey;
}

describe('SpawnResourceFeature', () => {
  it('regrows a resource on an empty hex once its timer has elapsed', () => {
    const { map, tile } = mapWithDueSpawner();

    expect(new SpawnResourceFeature(map).spawn(10)).toBe(true);

    expect(keyOn(tile)).toBe(HEXOBJECT_KEYS.TREE);
    expect(tile.resourceSpawner?.nextSpawnAt).toBeNull();
  });

  it('does not regrow while another hexobject, such as a return portal, stands on the hex', () => {
    const { map, tile } = mapWithDueSpawner();
    tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.RETURN_PORTAL, tile.coordinates);

    expect(new SpawnResourceFeature(map).spawn(10)).toBe(false);

    expect(keyOn(tile)).toBe(HEXOBJECT_KEYS.RETURN_PORTAL);
    expect(tile.resourceSpawner?.nextSpawnAt).toBe(0);
  });

  it('regrows once the blocking hexobject is gone', () => {
    const { map, tile } = mapWithDueSpawner();
    tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.RETURN_PORTAL, tile.coordinates);
    new SpawnResourceFeature(map).spawn(10);

    tile.hexobject = null;

    expect(new SpawnResourceFeature(map).spawn(20)).toBe(true);
    expect(keyOn(tile)).toBe(HEXOBJECT_KEYS.TREE);
  });
});
