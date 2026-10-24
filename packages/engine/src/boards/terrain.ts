export const TERRAIN_IDS = ['ground', 'mountain', 'water'] as const;
export type TerrainId = (typeof TERRAIN_IDS)[number];

export interface TerrainDefinition {
  symbol: string;
  passable: boolean;
  stepCost: number;
  fill: TerrainId;
}

export const TERRAIN: Record<TerrainId, TerrainDefinition> = {
  ground: { symbol: '.', passable: true, stepCost: 1, fill: 'ground' },
  mountain: { symbol: '^', passable: false, stepCost: 1, fill: 'mountain' },
  water: { symbol: '=', passable: false, stepCost: 1, fill: 'water' },
};

export const DEFAULT_TERRAIN: TerrainId = 'ground';

export function isTerrainPassable(terrain: TerrainId | undefined): boolean {
  return TERRAIN[terrain ?? DEFAULT_TERRAIN].passable;
}

export function terrainStepCost(terrain: TerrainId | undefined): number {
  return TERRAIN[terrain ?? DEFAULT_TERRAIN].stepCost;
}

export function terrainFromSymbol(symbol: string): TerrainId | null {
  const found = TERRAIN_IDS.find((id) => id !== DEFAULT_TERRAIN && TERRAIN[id].symbol === symbol);
  return found ?? null;
}
