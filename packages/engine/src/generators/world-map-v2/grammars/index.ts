import type { SeededRandom } from '../../../utils/random-seeded';
import type { RegionTopologyGraph } from '../region-topology';
import { buildRouteForkGraph } from './route-fork';
import { buildBasinGraph } from './basin';
import { buildLandmarkRingGraph } from './landmark-ring';

export const GRAMMAR_IDS = ['ROUTE_FORK', 'BASIN', 'LANDMARK_RING'] as const;
export type GrammarId = (typeof GRAMMAR_IDS)[number];

export const GRAMMAR_BUILDERS: Record<GrammarId, (rng: SeededRandom) => RegionTopologyGraph> = {
  ROUTE_FORK: buildRouteForkGraph,
  BASIN: buildBasinGraph,
  LANDMARK_RING: buildLandmarkRingGraph,
};

export { buildRouteForkGraph, buildBasinGraph, buildLandmarkRingGraph };
