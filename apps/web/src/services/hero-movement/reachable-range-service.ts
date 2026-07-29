import type { IHexCoordinates } from '@/a-game-scenes/map-scene/interfaces/hex-tile-config-interface';
import type HexMapModel from '@/a-game-scenes/map-scene/models/hex-map-model';
import { buildTileIndex, getTraversableNeighbors } from '@/services/hero-movement/movement-grid';
import { coordinateKey } from '@/utils/hex-utils';

export function getReachableTileDistances(
  map: HexMapModel,
  start: IHexCoordinates,
  radius: number,
): Map<string, number> {
  const safeRadius = Math.max(0, Math.floor(radius || 0));
  const index = buildTileIndex(map);
  const startKey = coordinateKey(start);
  const distances = new Map<string, number>([[startKey, 0]]);
  const queue: IHexCoordinates[] = [{ ...start }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentKey = coordinateKey(current);
    const currentDistance = distances.get(currentKey) ?? 0;

    if (currentDistance >= safeRadius) continue;

    for (const neighbor of getTraversableNeighbors(index, current)) {
      const nextKey = coordinateKey(neighbor.coordinates);
      const nextDistance = currentDistance + 1;

      if (distances.has(nextKey) || nextDistance > safeRadius) continue;

      distances.set(nextKey, nextDistance);
      queue.push({ ...neighbor.coordinates });
    }
  }

  return distances;
}
