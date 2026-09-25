import { onBeforeUnmount, onMounted, watch, type ComputedRef, type Ref } from 'vue';
import type { IHexTile } from '@hexoflat/engine/map/models/hex-tile-model';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { coordinateKey } from '@hexoflat/engine/utils/hex-utils';
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
import { HEX_WORLD_SIZE, type BoardCamera, type PaneSize } from '@/render/board-camera';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useCombatStore } from '@/stores/combat-store';

export interface UseHexBoardOptions {
  canvasRef: Ref<HTMLCanvasElement | null>;
  paneSize: ComputedRef<PaneSize>;
  camera: ComputedRef<BoardCamera>;
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
  onTileHover: (tile: IHexTile) => void;
  onTileClick: (tile: IHexTile) => void;
  /** Dev-only board panel toggles (see dev-board-panel.vue) — both default away in production. */
  devPanel?: {
    showWholeBoard: ComputedRef<boolean>;
    zoneTintByCoordinateKey: ComputedRef<Map<string, number>>;
  };
  /**
   * Fired once the renderer has presented its first frame with every layer
   * already synced. "Vue mounted" is a much weaker signal — Pixi's init and
   * the pane measurement both resolve asynchronously afterwards — so this
   * is what "the board is interactive" actually means.
   */
  onBoardReady?: () => void;
}

const getTileSize = () => HEX_WORLD_SIZE;

function waitForValidPaneSize(paneSize: ComputedRef<PaneSize>): Promise<PaneSize> {
  return new Promise((resolve) => {
    if (paneSize.value.width > 0 && paneSize.value.height > 0) {
      resolve(paneSize.value);
      return;
    }

    const stop = watch(paneSize, (size) => {
      if (size.width <= 0 || size.height <= 0) return;
      stop();
      resolve(size);
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
  let stopWatchers: Array<() => void> = [];
  let cancelled = false;

  onMounted(async () => {
    const canvas = opts.canvasRef.value;
    if (!canvas) return;

    const initialPane = await waitForValidPaneSize(opts.paneSize);
    if (cancelled) return;

    board = await createHexBoardApp(canvas, initialPane.width, initialPane.height);
    if (cancelled) {
      board.destroy();
      board = null;
      return;
    }

    tilesLayer = createTilesLayer({
      worldContainer: board.worldContainer,
      getTileSize,
      worldStore,
      combatStore,
      onTileHover: opts.onTileHover,
      onTileClick: opts.onTileClick,
      isForceRevealed: () => opts.devPanel?.showWholeBoard.value ?? false,
      getZoneTint: (tile) =>
        opts.devPanel?.zoneTintByCoordinateKey.value.get(coordinateKey(tile.coordinates)) ?? null,
    });

    enemyVisionLayer = createEnemyVisionLayer({
      worldContainer: board.worldContainer,
      getTileSize,
    });

    heroLayer = createHeroLayer({
      worldContainer: board.worldContainer,
      getTileSize,
    });

    movePreviewLayer = createMovePreviewLayer({
      worldContainer: board.worldContainer,
      getTileSize,
    });

    combatMarkerLayer = createCombatMarkerLayer({
      worldContainer: board.worldContainer,
      getTileSize,
    });

    campHealLayer = createCampHealLayer({
      worldContainer: board.worldContainer,
      getTileSize,
    });

    stopWatchers.push(
      watch(
        [opts.paneSize, opts.camera],
        ([size, camera]) => {
          board?.resize(size.width, size.height);
          board?.setCamera(camera);
          board?.renderNow();
        },
        { immediate: true },
      ),
    );

    let hasFullySynced = false;

    stopWatchers.push(
      watch(
        opts.tilesDirtyTick,
        () => {
          const dirtyKeys = worldStore.consumeDirtyTileIds();
          tilesLayer?.syncTiles(opts.tiles.value, hasFullySynced ? dirtyKeys : undefined);
          hasFullySynced = true;
          tilesLayer?.syncDefendMarkers(opts.tiles.value);
          tilesLayer?.syncLockChips(opts.tiles.value, opts.healTickerNow.value);
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

    if (opts.devPanel) {
      stopWatchers.push(
        watch([opts.devPanel.showWholeBoard, opts.devPanel.zoneTintByCoordinateKey], () =>
          tilesLayer?.syncTiles(opts.tiles.value),
        ),
      );
    }

    stopWatchers.push(watch(opts.tiles, (tiles) => tilesLayer?.syncTiles(tiles)));

    stopWatchers.push(
      watch(opts.healTickerNow, (now) => tilesLayer?.syncLockChips(opts.tiles.value, now)),
    );

    stopWatchers.push(
      watch(opts.heroCoordinates, () => heroLayer?.syncHero(opts.heroCoordinates.value), {
        immediate: true,
      }),
    );

    stopWatchers.push(
      watch(
        [
          opts.movePreview.segments,
          opts.movePreview.markerCoord,
          opts.movePreview.reachable,
          opts.movePreview.stepCost,
          opts.movePreview.markerKind,
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
      watch(opts.enemyVisionCells, () => enemyVisionLayer?.syncCells(opts.enemyVisionCells.value), {
        immediate: true,
        deep: true,
      }),
    );

    stopWatchers.push(
      watch(opts.combatMarkers, () => combatMarkerLayer?.syncMarkers(opts.combatMarkers.value), {
        immediate: true,
        deep: true,
      }),
    );

    stopWatchers.push(
      watch(
        [opts.campHeal.coord, opts.campHeal.active, opts.campHeal.label],
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
