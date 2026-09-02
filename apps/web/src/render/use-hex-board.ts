import { onBeforeUnmount, onMounted, watch, type ComputedRef, type Ref } from 'vue';
import type { IHexTile } from '@hexoflat/engine/map/models/hex-tile-model';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { createHexBoardApp, type HexBoardApp } from '@/render/pixi-app';
import { createTilesLayer, type TilesLayer } from '@/render/layers/tiles-layer';
import { createHeroLayer, type HeroLayer } from '@/render/layers/hero-layer';
import {
  createMovePreviewLayer,
  type MovePreviewLayer,
  type MovePreviewSyncParams,
} from '@/render/layers/move-preview-layer';
import {
  createEnemyVisionLayer,
  type EnemyVisionCell,
  type EnemyVisionLayer,
} from '@/render/layers/enemy-vision-layer';
import {
  createCombatMarkerLayer,
  type CombatMarkerEntry,
  type CombatMarkerLayer,
} from '@/render/layers/combat-marker-layer';
import { createCampHealLayer, type CampHealLayer } from '@/render/layers/camp-heal-layer';
import { createHexGridLayer, type HexGridLayer } from '@/render/layers/hex-grid-layer';
import {
  createFrontierPromiseLayer,
  type FrontierPromiseEntry,
  type FrontierPromiseLayer,
} from '@/render/layers/frontier-promise-layer';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useCombatStore } from '@/stores/combat-store';

export interface UseHexBoardOptions {
  canvasRef: Ref<HTMLCanvasElement | null>;
  mapBounds: ComputedRef<{ width: number; height: number; offsetX: number; offsetY: number }>;
  domTileSize: ComputedRef<{ w: number; h: number }>;
  tiles: ComputedRef<IHexTile[]>;
  /**
   * Bumped by world-map-store.ts's markTileDirty/markTilesDirty/markAllTilesDirty
   * whenever a tile mutates. Watching this instead of deep-watching `tiles`
   * lets the tiles-layer sync recompute just the tiles that actually changed.
   */
  tilesDirtyTick: ComputedRef<number>;
  heroCoordinates: ComputedRef<IHexCoordinates | null>;
  healTickerNow: Ref<number>;
  movePreview: {
    segments: ComputedRef<IHexCoordinates[]>;
    markerCoord: ComputedRef<IHexCoordinates | null>;
    reachable: ComputedRef<boolean>;
    stepCost: ComputedRef<number>;
    markerKind: ComputedRef<'move' | 'defend'>;
  };
  enemyVisionCells: ComputedRef<EnemyVisionCell[]>;
  combatMarkers: ComputedRef<CombatMarkerEntry[]>;
  campHeal: {
    coord: ComputedRef<IHexCoordinates | null>;
    active: ComputedRef<boolean>;
    label: ComputedRef<string>;
  };
  frontierPromises: ComputedRef<FrontierPromiseEntry[]>;
  showTechnicalGrid: ComputedRef<boolean>;
  onTileHover: (tile: IHexTile) => void;
  onTileClick: (tile: IHexTile) => void;
  /**
   * Fired once the renderer has presented its first frame with every layer
   * already synced. "Vue mounted" is a much weaker signal — Pixi's init and
   * the DOM tile-size probe both resolve asynchronously afterwards — so this
   * is what "the board is interactive" actually means.
   */
  onBoardReady?: () => void;
}

/**
 * Resolves once `mapBounds` has a real, non-zero size. The DOM tile-size
 * probe and Pixi's own async init race independently, with no ordering
 * guarantee — waiting here (rather than seeding Pixi with a 0/1px
 * placeholder) means the canvas is only ever created at its real size, so
 * it's never briefly too small to receive clicks at their intended screen
 * position.
 */
function waitForValidMapBounds(
  mapBounds: ComputedRef<{ width: number; height: number }>,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    if (mapBounds.value.width > 0 && mapBounds.value.height > 0) {
      resolve(mapBounds.value);
      return;
    }

    const stop = watch(mapBounds, (bounds) => {
      if (bounds.width <= 0 || bounds.height <= 0) return;
      stop();
      resolve(bounds);
    });
  });
}

export function useHexBoard(opts: UseHexBoardOptions) {
  const worldStore = useWorldMapStore();
  const combatStore = useCombatStore();

  let board: HexBoardApp | null = null;
  let tilesLayer: TilesLayer | null = null;
  let heroLayer: HeroLayer | null = null;
  let movePreviewLayer: MovePreviewLayer | null = null;
  let enemyVisionLayer: EnemyVisionLayer | null = null;
  let combatMarkerLayer: CombatMarkerLayer | null = null;
  let campHealLayer: CampHealLayer | null = null;
  let frontierPromiseLayer: FrontierPromiseLayer | null = null;
  let hexGridLayer: HexGridLayer | null = null;
  let stopWatchers: Array<() => void> = [];
  let cancelled = false;

  onMounted(async () => {
    const canvas = opts.canvasRef.value;
    if (!canvas) return;

    const initialBounds = await waitForValidMapBounds(opts.mapBounds);
    if (cancelled) return;

    board = await createHexBoardApp(canvas, initialBounds.width, initialBounds.height);
    if (cancelled) {
      board.destroy();
      board = null;
      return;
    }

    tilesLayer = createTilesLayer({
      worldContainer: board.worldContainer,
      getTileSize: () => opts.domTileSize.value,
      worldStore,
      combatStore,
      onTileHover: opts.onTileHover,
      onTileClick: opts.onTileClick,
    });

    enemyVisionLayer = createEnemyVisionLayer({
      worldContainer: board.worldContainer,
      getTileSize: () => opts.domTileSize.value,
    });

    heroLayer = createHeroLayer({
      worldContainer: board.worldContainer,
      getTileSize: () => opts.domTileSize.value,
    });

    movePreviewLayer = createMovePreviewLayer({
      worldContainer: board.worldContainer,
      getTileSize: () => opts.domTileSize.value,
    });

    combatMarkerLayer = createCombatMarkerLayer({
      worldContainer: board.worldContainer,
      getTileSize: () => opts.domTileSize.value,
    });

    campHealLayer = createCampHealLayer({
      worldContainer: board.worldContainer,
      getTileSize: () => opts.domTileSize.value,
    });

    frontierPromiseLayer = createFrontierPromiseLayer({
      worldContainer: board.worldContainer,
      getTileSize: () => opts.domTileSize.value,
    });

    hexGridLayer = createHexGridLayer({
      worldContainer: board.worldContainer,
      getTileSize: () => opts.domTileSize.value,
    });

    stopWatchers.push(
      watch(opts.mapBounds, (bounds) => board?.resize(bounds.width, bounds.height), {
        immediate: true,
      }),
    );

    // A tile-size change repositions/redraws every tile (full sync); a
    // dirtyTick bump only touches the tiles that were actually marked dirty.
    // Both share one flag rather than two separate watchers so the very
    // first (immediate) call — which must always be a full sync, since
    // tilesLayer has no nodes yet — only fires once instead of twice.
    let previousDomTileSize: { w: number; h: number } | null = null;

    stopWatchers.push(
      watch(
        [opts.tilesDirtyTick, opts.domTileSize, opts.showTechnicalGrid],
        ([, domTileSize]) => {
          const previous = previousDomTileSize;
          const sizeChanged =
            !previous || previous.w !== domTileSize.w || previous.h !== domTileSize.h;
          previousDomTileSize = domTileSize;

          const dirtyKeys = worldStore.consumeDirtyTileIds();
          tilesLayer?.syncTiles(opts.tiles.value, sizeChanged ? undefined : dirtyKeys);
          tilesLayer?.syncDefendMarkers(opts.tiles.value);
          tilesLayer?.syncLockChips(opts.tiles.value, opts.healTickerNow.value);
          hexGridLayer?.sync(opts.tiles.value, opts.showTechnicalGrid.value);
        },
        { immediate: true },
      ),
    );

    stopWatchers.push(
      watch(
        () => combatStore.combatMarkers,
        () => tilesLayer?.syncDefendMarkers(opts.tiles.value),
        { deep: true },
      ),
    );

    stopWatchers.push(
      watch(opts.healTickerNow, (now) => tilesLayer?.syncLockChips(opts.tiles.value, now)),
    );

    stopWatchers.push(
      watch(
        [opts.heroCoordinates, opts.domTileSize],
        () => heroLayer?.syncHero(opts.heroCoordinates.value),
        { immediate: true },
      ),
    );

    stopWatchers.push(
      watch(
        [
          opts.movePreview.segments,
          opts.movePreview.markerCoord,
          opts.movePreview.reachable,
          opts.movePreview.stepCost,
          opts.movePreview.markerKind,
          opts.domTileSize,
        ],
        () => {
          const params: MovePreviewSyncParams = {
            segments: opts.movePreview.segments.value,
            reachable: opts.movePreview.reachable.value,
            markerCoord: opts.movePreview.markerCoord.value,
            stepCost: opts.movePreview.stepCost.value,
            markerKind: opts.movePreview.markerKind.value,
          };
          movePreviewLayer?.sync(params);
        },
        { immediate: true, deep: true },
      ),
    );

    stopWatchers.push(
      watch(
        [opts.enemyVisionCells, opts.domTileSize],
        () => enemyVisionLayer?.syncCells(opts.enemyVisionCells.value),
        { immediate: true, deep: true },
      ),
    );

    stopWatchers.push(
      watch(
        [opts.combatMarkers, opts.domTileSize],
        () => combatMarkerLayer?.syncMarkers(opts.combatMarkers.value),
        { immediate: true, deep: true },
      ),
    );

    stopWatchers.push(
      watch(
        [opts.campHeal.coord, opts.campHeal.active, opts.campHeal.label, opts.domTileSize],
        () => {
          campHealLayer?.sync({
            coord: opts.campHeal.coord.value,
            active: opts.campHeal.active.value,
            label: opts.campHeal.label.value,
          });
        },
        { immediate: true, deep: true },
      ),
    );

    stopWatchers.push(
      watch(
        [opts.frontierPromises, opts.domTileSize],
        () => frontierPromiseLayer?.sync(opts.frontierPromises.value),
        { immediate: true, deep: true },
      ),
    );

    // Registered after every layer's `immediate: true` watcher has already
    // run, so the frame this waits on is a fully populated one.
    board.onFirstFramePresented(() => {
      if (cancelled) return;
      opts.onBoardReady?.();
    });
  });

  onBeforeUnmount(() => {
    cancelled = true;
    for (const stop of stopWatchers) stop();
    stopWatchers = [];
    for (const layer of [
      tilesLayer,
      heroLayer,
      movePreviewLayer,
      enemyVisionLayer,
      combatMarkerLayer,
      campHealLayer,
      frontierPromiseLayer,
      hexGridLayer,
    ]) {
      layer?.destroy();
    }
    board?.destroy();
    board = null;
  });
}
