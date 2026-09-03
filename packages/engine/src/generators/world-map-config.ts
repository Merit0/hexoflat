import type { TWorldArchetypeKey } from '../content/world-section-schema';

export interface WorldMapMvpConfig {
  knownHexMin: number;
  knownHexMax: number;
  growTargetHexes: number;
  minOpenAreaSize: number;
  minPocketSize: number;
  maxSeedAttempts: number;
  symmetryRejectThreshold: number;
  requiredPromises: number;
  maxPromises: number;
  targetLoops: number;
  minMeanNeighbours: number;
  maxThinShare: number;
  maxArticulationShare: number;
  archetypeWeights: Partial<Record<TWorldArchetypeKey, number>>;
}

export const DEFAULT_WORLD_MAP_CONFIG: WorldMapMvpConfig = {
  knownHexMin: 45,
  knownHexMax: 135,
  growTargetHexes: 5,
  minOpenAreaSize: 12,
  minPocketSize: 6,
  maxSeedAttempts: 24,
  symmetryRejectThreshold: 1.5,
  requiredPromises: 1,
  maxPromises: 3,
  targetLoops: 2,
  minMeanNeighbours: 3.5,
  maxThinShare: 0.25,
  maxArticulationShare: 0.15,
  archetypeWeights: {
    FORKED_FRONTIER: 3,
    RIDGE_AND_POCKET: 2,
    OPEN_FIELD_NARROW_PASS: 2,
    LANDMARK_PULL: 1,
  },
};
