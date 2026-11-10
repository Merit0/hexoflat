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

export interface TestTrader {
  key: string;
  serial: number;
  trips: number;
  goods: ({ key: string; amount: number } | null)[];
  buyback: ({ key: string; amount: number; unitPrice: number } | null)[];
  refreshPrice: number;
}

export interface TestTraderFixture {
  trader?: string;
  goods?: ({ key: string; amount: number } | null)[];
  buyback?: ({ key: string; amount: number; unitPrice: number } | null)[];
  trips?: number;
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
  getStash(): ({ key: string; amount: number; id: string } | null)[];
  getBag(): ({ key: string; amount: number; id: string } | null)[];
  getStashChests(): number;
  setStashChests(chests: number): void;
  setStash(cells: ({ key: string; amount: number } | null)[]): void;
  setBag(cells: ({ key: string; amount: number } | null)[]): void;
  settleInventorySync(): Promise<void>;
  getInventorySyncStatus(): string;
  setHeroHealth(current: number): void;
  placeHexobjectNextToHero(key: string): Promise<TestHexCoordinates>;
  isBattleEngaged(): boolean;
  finishBattle(outcome: 'victory' | 'defeat'): Promise<void>;
  giveHeroTheTurn(will?: number): Promise<void>;
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
  giveEnemyTheTurn(): Promise<void>;
  crowdTheHero(adjacent?: number, far?: number): Promise<void>;
  holdTheWindowOpen(extraMs: number): Promise<void>;
  getBattleHexPoint(q: number, r: number): { x: number; y: number } | null;

  previewPortalOpening(coordinates: TestHexCoordinates): TestPortalPreview;

  getTrader(key?: string): TestTrader | null;
  getOpenTrader(): string | null;
  getWalletCoins(): number;
  setTrader(fixture: TestTraderFixture): Promise<void>;
}
