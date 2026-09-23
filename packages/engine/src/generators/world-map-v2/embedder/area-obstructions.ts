import { coordinateKey, getHexNeighbors } from '../../../utils/hex-utils';
import type { IHexCoordinates } from '../../../map/interfaces/hex-tile-config-interface';
import { isConnectedSet, keyToCoord } from './hex-key-utils';

export type CarveResult = { ok: true; blocked: Set<string> } | { ok: false; reason: string };

/**
 * Carves a small blocked cluster growing outward from `center` within
 * `areaCells` — an OBSTRUCTION node's own hexes for its host area, or a
 * LANDMARK's mass inside its own area. Tries the requested size first, then
 * progressively smaller ones, and only accepts a size that leaves the rest
 * of the area connected (plan G2b: "площа має лишатися звʼязною довкола
 * перешкоди") — never returns a cluster that would cut the area in two.
 */
export function carveBlockedCluster(
  areaCells: Set<string>,
  center: IHexCoordinates,
  desiredSize: number,
): CarveResult {
  const centerKey = coordinateKey(center);
  if (!areaCells.has(centerKey)) {
    return { ok: false, reason: 'blocked-cluster center is not one of its own area’s hexes' };
  }

  const maxSize = Math.max(1, Math.min(desiredSize, areaCells.size - 1));

  for (let size = maxSize; size >= 1; size -= 1) {
    const cluster = new Set<string>([centerKey]);
    const queue = [centerKey];

    while (cluster.size < size && queue.length) {
      const current = queue.shift() as string;
      for (const neighbor of getHexNeighbors(keyToCoord(current))) {
        const neighborKey = coordinateKey(neighbor);
        if (!areaCells.has(neighborKey) || cluster.has(neighborKey)) continue;
        cluster.add(neighborKey);
        queue.push(neighborKey);
        if (cluster.size >= size) break;
      }
    }

    const remaining = new Set([...areaCells].filter((key) => !cluster.has(key)));
    if (isConnectedSet(remaining)) {
      return { ok: true, blocked: cluster };
    }
  }

  return { ok: false, reason: 'no blocked-cluster size keeps the rest of the area connected' };
}
