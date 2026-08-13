import type HexMapModel from './models/hex-map-model';
import type { HexTileModel } from './models/hex-tile-model';
import type { HexObjectPlacementRef } from '../abstraction/hex-map-placement';
import { coordinateKey } from '../utils/hex-utils';

export interface MissingSpawner {
  tile: HexTileModel;
  hexobject: HexObjectPlacementRef;
}

/**
 * Which tiles the map's content declares a resource spawner for but do not
 * have one yet.
 *
 * Answering this is a content rule — it depends on how placements map onto
 * tiles, not on how the app happens to apply the result — so it belongs with
 * the map. The caller still issues the ADD_RESOURCE_SPAWNER commands, which
 * keeps the command pipeline as the only way state actually changes
 * (architecture rule #1).
 *
 * Tiles that already carry a spawner are skipped, which is what makes
 * hydration safe to re-run on every load.
 */
export function findTilesMissingSpawners(map: HexMapModel): MissingSpawner[] {
  if (!map.config?.length) return [];

  const tileByKey = new Map<string, HexTileModel>();
  for (const tile of map.tiles) tileByKey.set(coordinateKey(tile.coordinates), tile);

  const missing: MissingSpawner[] = [];
  for (const placement of map.config) {
    if (!placement.hexobject) continue;

    for (const coord of placement.coordinates) {
      const tile = tileByKey.get(coordinateKey(coord));
      if (!tile || tile.resourceSpawner) continue;
      missing.push({ tile, hexobject: placement.hexobject });
    }
  }

  return missing;
}
