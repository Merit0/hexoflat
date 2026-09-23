import type { SeededRandom } from '../../../utils/random-seeded';
import type { BoardGenerationProfile } from '../board-seed';
import type { RegionGraphNode, RegionGraphNodeRole } from '../region-topology';

/** No grown area is allowed to be smaller than this — below it, a "room" reads as a single tile, not a place. */
export const MIN_AREA_HEXES = 10;

/** D17: passable share of the whole board, drawn from the seed within the profile's band. */
export const FILL_SHARE_RANGE: Record<BoardGenerationProfile, [number, number]> = {
  WORLD: [0.55, 0.65],
  DUNGEON: [0.4, 0.5],
};

/**
 * Relative area sizes by role. A BASIN-style FORK (one hosting an
 * OBSTRUCTION) and LANDMARK get the biggest weights — an obstacle or a
 * landmark needs room to read as "inside an area", not glued to a corridor
 * (plan G2b). PORTAL and POI are the smallest: a portal is a doorway, a POI
 * a single point of interest, neither needs to be a large room.
 */
const ROLE_WEIGHTS: Partial<Record<RegionGraphNodeRole, number>> = {
  ENTRY: 1.5,
  FORK: 2,
  MERGE: 1.5,
  TRANSIT: 1,
  POI: 0.75,
  LANDMARK: 3,
  PORTAL: 0.75,
};
const OBSTRUCTION_HOST_BONUS = 2;

export interface AreaBudgetResult {
  budgets: Map<string, number>;
  fillShare: number;
}

export function computeAreaBudgets(
  areaNodes: RegionGraphNode[],
  obstructionHostIds: Set<string>,
  profile: BoardGenerationProfile,
  totalBoardCells: number,
  rng: SeededRandom,
): AreaBudgetResult {
  const [min, max] = FILL_SHARE_RANGE[profile];
  const fillShare = min + rng() * (max - min);
  const totalBudget = Math.round(totalBoardCells * fillShare);

  const weighted = areaNodes.map((node) => ({
    id: node.id,
    weight:
      (ROLE_WEIGHTS[node.role] ?? 1) +
      (obstructionHostIds.has(node.id) ? OBSTRUCTION_HOST_BONUS : 0),
  }));
  const sumWeights = weighted.reduce((sum, entry) => sum + entry.weight, 0);

  const budgets = new Map<string, number>();
  for (const { id, weight } of weighted) {
    const raw = Math.round((totalBudget * weight) / sumWeights);
    budgets.set(id, Math.max(raw, MIN_AREA_HEXES));
  }

  return { budgets, fillShare };
}
