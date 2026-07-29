import type { IHexCoordinates } from '@/a-game-scenes/map-scene/interfaces/hex-tile-config-interface';
import {
  buildTileIndex,
  getTraversableNeighbors,
  isTraversableTile,
  type TileMapLike,
  type TileIndex,
} from '@/services/hero-movement/movement-grid';
import { coordinateKey, hexDistance } from '@/utils/hex-utils';

function reconstructPath(
  targetKey: string,
  startKey: string,
  cameFrom: Map<string, string>,
  index: TileIndex,
): IHexCoordinates[] | null {
  const pathKeys: string[] = [targetKey];
  let currentKey = targetKey;

  while (currentKey !== startKey) {
    const previousKey = cameFrom.get(currentKey);
    if (!previousKey) return null;

    pathKeys.unshift(previousKey);
    currentKey = previousKey;
  }

  return pathKeys
    .map((key) => index.get(key)?.coordinates)
    .filter((coord): coord is IHexCoordinates => !!coord)
    .map((coord) => ({ ...coord }));
}

export function findShortestPath(
  map: TileMapLike,
  start: IHexCoordinates,
  target: IHexCoordinates,
  maxSteps?: number | null,
): IHexCoordinates[] | null {
  const safeMaxSteps =
    typeof maxSteps === 'number' && Number.isFinite(maxSteps)
      ? Math.max(0, Math.floor(maxSteps))
      : Number.POSITIVE_INFINITY;
  const index = buildTileIndex(map);
  const startKey = coordinateKey(start);
  const targetKey = coordinateKey(target);

  if (startKey === targetKey) {
    return [{ ...start }];
  }

  const targetTile = index.get(targetKey);
  if (!isTraversableTile(targetTile)) return null;
  if (Number.isFinite(safeMaxSteps) && hexDistance(start, target) > safeMaxSteps) return null;

  const openKeys = new Set<string>([startKey]);
  const openQueue: string[] = [startKey];
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[startKey, 0]]);
  const fScore = new Map<string, number>([[startKey, hexDistance(start, target)]]);

  while (openQueue.length > 0) {
    let currentIndex = 0;

    for (let i = 1; i < openQueue.length; i++) {
      const a = fScore.get(openQueue[i]) ?? Number.POSITIVE_INFINITY;
      const b = fScore.get(openQueue[currentIndex]) ?? Number.POSITIVE_INFINITY;
      if (a < b) currentIndex = i;
    }

    const currentKey = openQueue[currentIndex];
    openQueue.splice(currentIndex, 1);
    openKeys.delete(currentKey);

    const currentTile = index.get(currentKey);
    if (!currentTile) continue;

    if (currentKey === targetKey) {
      return reconstructPath(targetKey, startKey, cameFrom, index);
    }

    const currentScore = gScore.get(currentKey) ?? Number.POSITIVE_INFINITY;
    if (currentScore >= safeMaxSteps) continue;

    for (const neighbor of getTraversableNeighbors(index, currentTile.coordinates)) {
      const neighborKey = coordinateKey(neighbor.coordinates);
      const tentativeScore = currentScore + 1;

      if (tentativeScore > safeMaxSteps) continue;
      if (tentativeScore >= (gScore.get(neighborKey) ?? Number.POSITIVE_INFINITY)) continue;

      cameFrom.set(neighborKey, currentKey);
      gScore.set(neighborKey, tentativeScore);
      fScore.set(neighborKey, tentativeScore + hexDistance(neighbor.coordinates, target));

      if (!openKeys.has(neighborKey)) {
        openKeys.add(neighborKey);
        openQueue.push(neighborKey);
      }
    }
  }

  return null;
}
