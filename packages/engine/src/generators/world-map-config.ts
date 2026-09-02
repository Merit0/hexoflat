import type { TWorldArchetypeKey } from '../content/world-section-schema';

export interface WorldMapMvpConfig {
  knownHexMin: number;
  knownHexMax: number;
  minOpenAreaSize: number;
  minPocketSize: number;
  maxSeedAttempts: number;
  symmetryRejectThreshold: number;
  archetypeWeights: Partial<Record<TWorldArchetypeKey, number>>;
}

export const DEFAULT_WORLD_MAP_CONFIG: WorldMapMvpConfig = {
  knownHexMin: 12,
  knownHexMax: 34,
  minOpenAreaSize: 5,
  minPocketSize: 3,
  maxSeedAttempts: 20,
  symmetryRejectThreshold: 1.5,
  archetypeWeights: { FORKED_FRONTIER: 1 },
};
