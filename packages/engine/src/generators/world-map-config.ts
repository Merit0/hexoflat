import type { TWorldArchetypeKey } from '../content/world-section-schema';

export interface WorldMapMvpConfig {
  knownHexMin: number;
  knownHexMax: number;
  minOpenAreaSize: number;
  minPocketSize: number;
  maxSeedAttempts: number;
  symmetryRejectThreshold: number;
  requiredPromises: number;
  maxPromises: number;
  archetypeWeights: Partial<Record<TWorldArchetypeKey, number>>;
}

export const DEFAULT_WORLD_MAP_CONFIG: WorldMapMvpConfig = {
  knownHexMin: 12,
  knownHexMax: 34,
  minOpenAreaSize: 5,
  minPocketSize: 3,
  maxSeedAttempts: 20,
  symmetryRejectThreshold: 1.5,
  requiredPromises: 1,
  maxPromises: 3,
  archetypeWeights: {
    FORKED_FRONTIER: 3,
    RIDGE_AND_POCKET: 2,
    OPEN_FIELD_NARROW_PASS: 2,
    LANDMARK_PULL: 1,
  },
};
