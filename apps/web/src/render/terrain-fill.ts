import type { TerrainId } from '@hexoflat/engine/boards/terrain';

const TERRAIN_FILL_COLORS: Record<TerrainId, number | null> = {
  ground: null,
  mountain: 0x8c93a0,
  water: 0x7aaed0,
};

export function terrainFillColor(terrain: TerrainId | undefined): number | null {
  return TERRAIN_FILL_COLORS[terrain ?? 'ground'];
}
