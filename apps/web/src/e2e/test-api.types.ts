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

export interface TestPortalPreview {
  ok: boolean;
  oneWay: boolean;
  reason: string | null;
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
  setSkillRank(skillId: string, rank: number): void;
  getWalkRoute(to: TestHexCoordinates): TestHexCoordinates[] | null;
  getWillSlotKey(): string;
  getKnowledgeRules(): { startingWill: number; capacity: number };
  isBoardReady(): boolean;

  getHeroCoordinates(): TestHexCoordinates | null;

  getTileFraction(coordinates: TestHexCoordinates): TestTileFraction;

  getNeighbors(coordinates: TestHexCoordinates): TestHexCoordinates[];
  countExistingNeighbours(coordinates: TestHexCoordinates): number;

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

  getCurrentLocationKey(): string;

  findTilesWithKey(key: string): TestHexCoordinates[];

  getInventoryItemAmount(key: string): number;
  grantInventoryItem(key: string, amount: number): void;
  setHeroHealth(current: number): void;
  placeSquadNextToHero(key: string): TestHexCoordinates;
  isBattleEngaged(): boolean;
  finishBattle(outcome: 'victory' | 'defeat'): void;
  giveHeroTheTurn(will?: number): void;
  getBattleHands(): {
    right: string | null;
    left: string | null;
    bag: string[];
    will: number;
  } | null;

  getBattleSnapshot(): {
    round: number;
    phase: string;
    activeId: string;
    order: string[];
    draws: Record<string, number>;
    turnWill: number;
    reaction: { stage: 'block' | 'aim'; attackerId: string; defenderId: string } | null;
    creatures: { id: string; side: string; hp: number; maxHp: number; q: number; r: number }[];
    wounds: Record<string, { q: number; r: number }[]>;
    heroDistances: Record<string, number>;
    placedShields: number;
    revealedShields: number;
    heroFreeNeighbours: { q: number; r: number }[];
    terrain: Record<string, number>;
    terrainByHex: Record<string, string>;
    aimOptions: { q: number; r: number }[];
  } | null;
  giveEnemyTheTurn(): void;
  crowdTheHero(adjacent?: number, far?: number): void;
  holdTheWindowOpen(extraMs: number): void;
  getBattleHexPoint(q: number, r: number): { x: number; y: number } | null;

  previewPortalOpening(coordinates: TestHexCoordinates): TestPortalPreview;
}
