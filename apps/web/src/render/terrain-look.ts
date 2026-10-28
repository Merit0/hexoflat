import type { TerrainId } from '@hexoflat/engine/boards/terrain';

export interface TerrainLook {
  background: string;
  sprite: string | null;
}

const BATTLE_RELIEF_ON_MAP: TerrainLook = {
  background: '/hex-assets/board-hexes/stone-hex.png',
  sprite: null,
};

const TERRAIN_LOOKS: Partial<Record<TerrainId, TerrainLook>> = {
  mountain: {
    background: '/hex-assets/board-hexes/stone-hex.png',
    sprite: '/hex-assets/hex-resources/rock-token-image.png',
  },
  water: {
    background: '/hex-assets/board-hexes/water-hex.png',
    sprite: null,
  },
  ...Object.fromEntries(
    (['rubble', 'ledge', 'oil', 'saw'] as const).map((id) => [id, BATTLE_RELIEF_ON_MAP]),
  ),
};

export function terrainLook(terrain: TerrainId | undefined): TerrainLook | null {
  return TERRAIN_LOOKS[terrain ?? 'ground'] ?? null;
}
