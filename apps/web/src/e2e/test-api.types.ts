/**
 * The contract apps/playwright drives the game through.
 *
 * Deliberately import-free and runtime-free: apps/playwright type-imports
 * this exact file (via its `@web-test-api` path alias) so the app owns the
 * contract and any change here surfaces as a typecheck failure in the e2e
 * package instead of a runtime surprise. Adding an import to this file would
 * drag apps/web's module graph (and its `vite/client` ambient types) into
 * Playwright's tsc program — keep the implementation in test-hooks-api.ts
 * instead.
 *
 * Why a scene-graph/state hook at all: the board is a PixiJS canvas, so there
 * is nothing in the DOM for a test to query. Without this, the e2e package
 * had to re-implement the engine's hex math (odd-q neighbours, hex distance,
 * pixel layout) to know where to click — a silent second source of truth that
 * broke the moment the real formula changed. Asking the running app for the
 * answer is the standard fix for canvas apps.
 */

export interface TestHexCoordinates {
  columnIndex: number;
  rowIndex: number;
}

/** Center of a tile as a fraction (0..1) of the board canvas's own box. */
export interface TestTileFraction {
  fx: number;
  fy: number;
}

export interface TestGridSize {
  width: number;
  height: number;
}

/** Mirrors the engine's `DiscoveryState`. Re-declared, not imported: this file stays import-free. */
export type TestDiscoveryState = 'UNKNOWN' | 'OBSERVED' | 'DISCOVERED' | 'UNDERSTOOD';

export interface HexoflatTestApi {
  /** True once the board has rendered its first real PixiJS frame. */
  isBoardReady(): boolean;

  /** Live hero position, or null before the world has placed the hero. */
  getHeroCoordinates(): TestHexCoordinates | null;

  /**
   * Where to click for a given tile, as a fraction of the canvas box — the
   * caller multiplies by the canvas bounding box, so this never has to know
   * the page's live CSS scale.
   */
  getTileFraction(coordinates: TestHexCoordinates): TestTileFraction;

  /** Neighbours straight from the engine's odd-q implementation. */
  getNeighbors(coordinates: TestHexCoordinates): TestHexCoordinates[];

  /** Hex distance straight from the engine's implementation. */
  getDistance(from: TestHexCoordinates, to: TestHexCoordinates): number;

  /** Hexobject key sitting on a tile, or null if the tile is empty. */
  getTileHexobjectKey(coordinates: TestHexCoordinates): string | null;

  /** Item keys currently in the hero's inventory (equipped slots included). */
  getInventoryItemKeys(): string[];

  getInventoryItemIdByKey(key: string): string | null;

  openHeroInventory(): void;

  /** Dimensions of the active map. */
  getGridSize(): TestGridSize;

  /**
   * How much the player knows about a hex. `UNKNOWN` for any coordinate the
   * map has no tile for, which is the same thing from the player's side.
   */
  getTileDiscovery(coordinates: TestHexCoordinates): TestDiscoveryState;

  /**
   * How many tiles the renderer was handed for the current frame.
   *
   * The point of this is the assertion "no UNKNOWN hex is rendered" (invariant
   * I13). It reads the app's own visible-tiles list rather than counting
   * PixiJS nodes, because that list is what both the tile layer and the board
   * bounds are built from — counting anything else would be measuring a
   * different thing than the one that can regress.
   */
  getRenderedTileCount(): number;
}
