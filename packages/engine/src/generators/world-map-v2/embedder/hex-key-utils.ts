import { coordinateKey, getHexNeighbors } from '../../../utils/hex-utils';
import type { IHexCoordinates } from '../../../map/interfaces/hex-tile-config-interface';

export function keyToCoord(key: string): IHexCoordinates {
  const [columnIndex, rowIndex] = key.split(':').map(Number);
  return { columnIndex, rowIndex };
}

/** Whether every cell in the set is reachable from every other through neighbours also in the set. */
export function isConnectedSet(cells: Set<string>): boolean {
  if (cells.size === 0) return true;
  const start = cells.values().next().value as string;
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const current = queue.shift() as string;
    for (const neighbor of getHexNeighbors(keyToCoord(current))) {
      const neighborKey = coordinateKey(neighbor);
      if (cells.has(neighborKey) && !seen.has(neighborKey)) {
        seen.add(neighborKey);
        queue.push(neighborKey);
      }
    }
  }
  return seen.size === cells.size;
}
