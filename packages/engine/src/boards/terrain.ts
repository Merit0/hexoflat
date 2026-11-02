export const TERRAIN_IDS = [
  'ground',
  'mountain',
  'water',
  'rubble',
  'ledge',
  'oil',
  'saw',
] as const;
export type TerrainId = (typeof TERRAIN_IDS)[number];

export interface TerrainDefinition {
  symbol: string | null;
  passable: boolean;
  alwaysVisible: boolean;
  fill: TerrainId;
}

export const TERRAIN: Record<TerrainId, TerrainDefinition> = {
  ground: { symbol: '.', passable: true, alwaysVisible: false, fill: 'ground' },
  mountain: { symbol: '^', passable: false, alwaysVisible: true, fill: 'mountain' },
  water: { symbol: '=', passable: false, alwaysVisible: false, fill: 'water' },
  rubble: { symbol: null, passable: true, alwaysVisible: false, fill: 'ground' },
  ledge: { symbol: null, passable: true, alwaysVisible: false, fill: 'ground' },
  oil: { symbol: null, passable: true, alwaysVisible: false, fill: 'ground' },
  saw: { symbol: null, passable: true, alwaysVisible: false, fill: 'ground' },
};

export const DEFAULT_TERRAIN: TerrainId = 'ground';

export function isTerrainPassable(terrain: TerrainId | undefined): boolean {
  return TERRAIN[terrain ?? DEFAULT_TERRAIN].passable;
}

export function isTerrainAlwaysVisible(terrain: TerrainId | undefined): boolean {
  return TERRAIN[terrain ?? DEFAULT_TERRAIN].alwaysVisible;
}

export function terrainFromSymbol(symbol: string): TerrainId | null {
  const found = TERRAIN_IDS.find(
    (id) => id !== DEFAULT_TERRAIN && TERRAIN[id].symbol !== null && TERRAIN[id].symbol === symbol,
  );
  return found ?? null;
}
