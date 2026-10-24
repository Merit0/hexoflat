export interface TestHexCoordinates {
  columnIndex: number;
  rowIndex: number;
}

export interface TestTileFraction {
  fx: number;
  fy: number;
}

export interface TestGridSize {
  width: number;
  height: number;
}

export interface TestHeroHealth {
  current: number;
  max: number;
}

export interface HexoflatTestApi {
  getKnowledge(): {
    current: number;
    status: string | null;
    index: number;
    options: number[];
    answer: number | null;
    lastAward: number;
  } | null;
  prepareKnowledgeWorld(current: number): void;
  setWill(current: number): void;
  getWalkRoute(to: TestHexCoordinates): TestHexCoordinates[] | null;
  getWillSlotKey(): string;
  getKnowledgeRules(): { startingWill: number; capacity: number };
  isBoardReady(): boolean;

  getHeroCoordinates(): TestHexCoordinates | null;

  getTileFraction(coordinates: TestHexCoordinates): TestTileFraction;

  getNeighbors(coordinates: TestHexCoordinates): TestHexCoordinates[];

  getDistance(from: TestHexCoordinates, to: TestHexCoordinates): number;

  getTileHexobjectKey(coordinates: TestHexCoordinates): string | null;

  getExitTile(side: 'N' | 'S' | 'W' | 'E'): TestHexCoordinates | null;

  isTileImpassableTerrain(coordinates: TestHexCoordinates): boolean;

  getHeroHealth(): TestHeroHealth;

  getInventoryItemKeys(): string[];

  getInventoryItemIdByKey(key: string): string | null;

  getGridSize(): TestGridSize;

  isToolUsed(): boolean;

  getToolHoverCoordinates(): TestHexCoordinates | null;
}
