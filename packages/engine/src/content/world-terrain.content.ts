import type { TWorldTerrainKey, WorldTerrainDef } from './world-section-schema';

export const WORLD_TERRAIN: Record<TWorldTerrainKey, WorldTerrainDef> = {
  OPEN_GROUND: { traversability: 'OPEN' },
  STONE_RIDGE: { traversability: 'BLOCKED' },
  FOREST_EDGE: { traversability: 'OPEN' },
  BROKEN_GROUND: { traversability: 'OPEN' },
  NARROW_PASS: { traversability: 'OPEN' },
  POCKET_FLOOR: { traversability: 'OPEN' },
  FRONTIER_EDGE: { traversability: 'OPEN' },
};
