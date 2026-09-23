import { coordinateKey, getHexNeighbors } from '../../../utils/hex-utils';
import type { IHexCoordinates } from '../../../map/interfaces/hex-tile-config-interface';
import type { SeededRandom } from '../../../utils/random-seeded';
import { keyToCoord } from './hex-key-utils';
import { MIN_AREA_HEXES } from './area-weights';

export type GrowAreasResult =
  { ok: true; claimed: Map<string, Set<string>> } | { ok: false; reason: string };

function shuffle<T>(items: T[], rng: SeededRandom): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function isEligible(occupied: Map<string, string>, nodeId: string, key: string): boolean {
  if (occupied.has(key)) return false;
  for (const neighbor of getHexNeighbors(keyToCoord(key))) {
    const owner = occupied.get(coordinateKey(neighbor));
    if (owner && owner !== nodeId) return false;
  }
  return true;
}

function placeAreaCenters(
  nodeIds: string[],
  seedCellsByNode: Map<string, Set<string>>,
  occupied: Map<string, string>,
  claimed: Map<string, Set<string>>,
): GrowAreasResult | null {
  for (const nodeId of nodeIds) {
    const claimedSet = claimed.get(nodeId) as Set<string>;
    const [center] = seedCellsByNode.get(nodeId) ?? [];
    if (center === undefined) continue;

    const existingOwner = occupied.get(center);
    if (existingOwner && existingOwner !== nodeId) {
      return {
        ok: false,
        reason: `area centres for "${nodeId}" and "${existingOwner}" land on the same hex`,
      };
    }
    for (const neighbor of getHexNeighbors(keyToCoord(center))) {
      const neighborOwner = occupied.get(coordinateKey(neighbor));
      if (neighborOwner && neighborOwner !== nodeId) {
        return {
          ok: false,
          reason: `area centres for "${nodeId}" and "${neighborOwner}" are placed hex-adjacent to each other, leaving no room for a wall between them`,
        };
      }
    }

    occupied.set(center, nodeId);
    claimedSet.add(center);
  }
  return null;
}

function placeArmCells(
  nodeIds: string[],
  seedCellsByNode: Map<string, Set<string>>,
  occupied: Map<string, string>,
  claimed: Map<string, Set<string>>,
): void {
  for (const nodeId of nodeIds) {
    const claimedSet = claimed.get(nodeId) as Set<string>;
    const armCells = [...(seedCellsByNode.get(nodeId) ?? [])].slice(1);
    for (const key of armCells) {
      if (occupied.has(key)) continue;
      if (!isEligible(occupied, nodeId, key)) continue;
      occupied.set(key, nodeId);
      claimedSet.add(key);
    }
  }
}

function checkNoDirectAdjacency(occupied: Map<string, string>): GrowAreasResult | null {
  for (const [key, nodeId] of occupied) {
    for (const neighbor of getHexNeighbors(keyToCoord(key))) {
      const neighborOwner = occupied.get(coordinateKey(neighbor));
      if (neighborOwner && neighborOwner !== nodeId) {
        return {
          ok: false,
          reason: `areas "${nodeId}" and "${neighborOwner}" ended up touching directly at (${key}) — not through a link`,
        };
      }
    }
  }
  return null;
}

function checkMinAreaFloor(
  nodeIds: string[],
  claimed: Map<string, Set<string>>,
): GrowAreasResult | null {
  for (const nodeId of nodeIds) {
    const size = claimed.get(nodeId)?.size ?? 0;
    if (size < MIN_AREA_HEXES) {
      return {
        ok: false,
        reason: `area "${nodeId}" only grew to ${size} hexes, below the ${MIN_AREA_HEXES}-hex floor`,
      };
    }
  }
  return null;
}

export function growAreas(
  seedCellsByNode: Map<string, Set<string>>,
  budgets: Map<string, number>,
  boardColumns: number,
  boardRows: number,
  rng: SeededRandom,
): GrowAreasResult {
  const nodeIds = [...seedCellsByNode.keys()];
  const occupied = new Map<string, string>();
  const claimed = new Map<string, Set<string>>();
  const queues = new Map<string, string[]>();
  const queued = new Map<string, Set<string>>();

  function inBounds(coord: IHexCoordinates): boolean {
    return (
      coord.columnIndex >= 0 &&
      coord.columnIndex < boardColumns &&
      coord.rowIndex >= 0 &&
      coord.rowIndex < boardRows
    );
  }

  function enqueueNeighbours(nodeId: string, key: string) {
    const queue = queues.get(nodeId) as string[];
    const seen = queued.get(nodeId) as Set<string>;
    const neighbours = getHexNeighbors(keyToCoord(key)).filter(inBounds).map(coordinateKey);
    for (const neighborKey of shuffle(neighbours, rng)) {
      if (occupied.has(neighborKey) || seen.has(neighborKey)) continue;
      seen.add(neighborKey);
      queue.push(neighborKey);
    }
  }

  for (const nodeId of nodeIds) {
    claimed.set(nodeId, new Set());
    queues.set(nodeId, []);
    queued.set(nodeId, new Set());
  }

  const centerFailure = placeAreaCenters(nodeIds, seedCellsByNode, occupied, claimed);
  if (centerFailure) return centerFailure;

  placeArmCells(nodeIds, seedCellsByNode, occupied, claimed);

  for (const nodeId of nodeIds) {
    for (const key of claimed.get(nodeId) as Set<string>) enqueueNeighbours(nodeId, key);
  }

  let progressed = true;
  while (progressed) {
    progressed = false;

    for (const nodeId of nodeIds) {
      const budget = budgets.get(nodeId) ?? MIN_AREA_HEXES;
      const claimedSet = claimed.get(nodeId) as Set<string>;
      if (claimedSet.size >= budget) continue;

      const queue = queues.get(nodeId) as string[];
      let chosen: string | null = null;
      while (queue.length) {
        const candidate = queue.shift() as string;
        if (isEligible(occupied, nodeId, candidate)) {
          chosen = candidate;
          break;
        }
      }
      if (!chosen) continue;

      occupied.set(chosen, nodeId);
      claimedSet.add(chosen);
      enqueueNeighbours(nodeId, chosen);
      progressed = true;
    }
  }

  const adjacencyFailure = checkNoDirectAdjacency(occupied);
  if (adjacencyFailure) return adjacencyFailure;

  const floorFailure = checkMinAreaFloor(nodeIds, claimed);
  if (floorFailure) return floorFailure;

  return { ok: true, claimed };
}
