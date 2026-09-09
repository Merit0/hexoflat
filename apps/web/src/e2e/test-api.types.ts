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
  isBoardReady(): boolean;

  getHeroCoordinates(): TestHexCoordinates | null;

  getTileFraction(coordinates: TestHexCoordinates): TestTileFraction;

  getNeighbors(coordinates: TestHexCoordinates): TestHexCoordinates[];

  getDistance(from: TestHexCoordinates, to: TestHexCoordinates): number;

  getTileHexobjectKey(coordinates: TestHexCoordinates): string | null;

  getHeroHealth(): TestHeroHealth;

  getInventoryItemKeys(): string[];

  getInventoryItemIdByKey(key: string): string | null;

  getGridSize(): TestGridSize;

  isToolUsed(): boolean;

  getToolHoverCoordinates(): TestHexCoordinates | null;
}
