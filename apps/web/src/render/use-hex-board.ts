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
import { useWorldMapStore } from '@/stores/world-map-store';

export interface UseHexBoardOptions {
  canvasRef: Ref<HTMLCanvasElement | null>;
  mapBounds: ComputedRef<{ width: number; height: number; offsetX: number; offsetY: number }>;
  domTileSize: ComputedRef<{ w: number; h: number }>;
  tiles: ComputedRef<IHexTile[]>;
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
  onTileHover: (tile: IHexTile) => void;
  onTileClick: (tile: IHexTile) => void;
  onOpenHeroInventory: () => void;
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

  let board: HexBoardApp | null = null;
  let tilesLayer: TilesLayer | null = null;
  let heroLayer: HeroLayer | null = null;
  let movePreviewLayer: MovePreviewLayer | null = null;
  let enemyVisionLayer: EnemyVisionLayer | null = null;
  let combatMarkerLayer: CombatMarkerLayer | null = null;
  let campHealLayer: CampHealLayer | null = null;
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
      onOpenInventory: opts.onOpenHeroInventory,
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

    stopWatchers.push(
      watch(opts.mapBounds, (bounds) => board?.resize(bounds.width, bounds.height), {
        immediate: true,
      }),
    );

    stopWatchers.push(
      watch(
        [opts.tiles, opts.domTileSize],
        () => {
          tilesLayer?.syncTiles(opts.tiles.value);
          tilesLayer?.syncDefendMarkers(opts.tiles.value);
          tilesLayer?.syncLockChips(opts.tiles.value, opts.healTickerNow.value);
        },
        { immediate: true, deep: true },
      ),
    );

    stopWatchers.push(
      watch(
        () => worldStore.combatMarkers,
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
  });

  onBeforeUnmount(() => {
    cancelled = true;
    for (const stop of stopWatchers) stop();
    stopWatchers = [];
    tilesLayer?.destroy();
    heroLayer?.destroy();
    movePreviewLayer?.destroy();
    enemyVisionLayer?.destroy();
    combatMarkerLayer?.destroy();
    campHealLayer?.destroy();
    board?.destroy();
    board = null;
    tilesLayer = null;
    heroLayer = null;
    movePreviewLayer = null;
    enemyVisionLayer = null;
    combatMarkerLayer = null;
    campHealLayer = null;
  });
}
