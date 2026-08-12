import {
  calcHexPixelPosition,
  getOddQNeighbors,
  hexDistance,
} from '@hexoflat/engine/utils/hex-utils';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useHeroStore } from '@/stores/hero-store';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useOverlayStore } from '@/stores/overlay-store';
import type {
  HexoflatTestApi,
  TestGridSize,
  TestHexCoordinates,
  TestTileFraction,
} from '@/e2e/test-api.types';

export interface MapBoundsSnapshot {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

export interface TileSizeSnapshot {
  w: number;
  h: number;
}

export interface CreateTestApiOptions {
  /** Live `mapBounds` of hex-world-map.vue — the box the canvas fills. */
  getMapBounds(): MapBoundsSnapshot;
  /** Live rendered tile box, the same value the renderer positions tiles with. */
  getTileSize(): TileSizeSnapshot;
  /** True once PixiJS has presented its first frame. */
  isBoardReady(): boolean;
}

/**
 * Builds the `window.__HEXOFLAT_TEST__` implementation out of the app's own
 * sources of truth: the engine's hex math, the world-map store and the
 * inventory store. Nothing here re-derives geometry — that duplication is
 * exactly what this API exists to delete from the e2e package.
 *
 * Only ever reached from a build with VITE_E2E_HOOKS=true (see test-hooks.ts).
 */
export function createTestApi(options: CreateTestApiOptions): HexoflatTestApi {
  const worldStore = useWorldMapStore();
  const heroStore = useHeroStore();
  const heroInventoryStore = useHeroInventoryStore();

  function findTile(coordinates: TestHexCoordinates) {
    return worldStore.map?.tiles.find(
      (tile) =>
        tile.coordinates.columnIndex === coordinates.columnIndex &&
        tile.coordinates.rowIndex === coordinates.rowIndex,
    );
  }

  return {
    isBoardReady(): boolean {
      return options.isBoardReady();
    },

    getHeroCoordinates(): TestHexCoordinates | null {
      const coordinates = heroStore.heroCoordinates;
      return coordinates
        ? { columnIndex: coordinates.columnIndex, rowIndex: coordinates.rowIndex }
        : null;
    },

    getTileFraction(coordinates: TestHexCoordinates): TestTileFraction {
      const bounds = options.getMapBounds();
      const { w, h } = options.getTileSize();

      if (!bounds.width || !bounds.height || !w || !h) {
        throw new Error(
          'getTileFraction() called before the board had a real size — wait for isBoardReady().',
        );
      }

      const { x, y } = calcHexPixelPosition({ coordinates }, w, h);

      return {
        fx: (x + w / 2 - bounds.offsetX) / bounds.width,
        fy: (y + h / 2 - bounds.offsetY) / bounds.height,
      };
    },

    getNeighbors(coordinates: TestHexCoordinates): TestHexCoordinates[] {
      return getOddQNeighbors(coordinates);
    },

    getDistance(from: TestHexCoordinates, to: TestHexCoordinates): number {
      return hexDistance(from, to);
    },

    getTileHexobjectKey(coordinates: TestHexCoordinates): string | null {
      return findTile(coordinates)?.hexobject?.hexobjectKey ?? null;
    },

    getInventoryItemKeys(): string[] {
      return heroInventoryStore.items.map((item) => item.key);
    },

    getInventoryItemIdByKey(key: string): string | null {
      return heroInventoryStore.items.find((item) => item.key === key)?.id ?? null;
    },

    openHeroInventory(): void {
      useOverlayStore().openOverlay('hero-inventory');
    },

    getGridSize(): TestGridSize {
      const map = worldStore.map;
      return { width: map?.width ?? 0, height: map?.height ?? 0 };
    },
  };
}
