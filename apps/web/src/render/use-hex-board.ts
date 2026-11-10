import { fogLookForBoardKind } from '@/render/fog-look';
import { MapRegistry } from '@hexoflat/engine/registry/world-map-registry';
import { onBeforeUnmount, onMounted, watch, type ComputedRef, type Ref } from 'vue';
import type { IHexTile } from '@hexoflat/engine/map/models/hex-tile-model';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { coordinateKey } from '@hexoflat/engine/utils/hex-utils';
import { createHexBoardApp, type HexBoardApp } from '@/render/pixi-app';
import { createTilesLayer, type TilePointer, type TilesLayer } from '@/render/layers/tiles-layer';
import { createHeroLayer, type HeroLayer } from '@/render/layers/hero-layer';
import {
  createMovePreviewLayer,
  type MovePreviewLayer,
  type MovePreviewSyncParams,
} from '@/render/layers/move-preview-layer';
import { createSquadWatchLayer, type SquadWatchLayer } from '@/render/layers/squad-watch-layer';
import { createPortalLayer, type PortalLayer } from '@/render/layers/portal-layer';
import { registerPortalFx } from '@/render/portal-fx';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { HEX_WORLD_SIZE, type BoardCamera, type PaneSize } from '@/render/board-camera';
import { useWorldMapStore } from '@/stores/world-map-store';

export interface UseHexBoardOptions {
  canvasRef: Ref<HTMLCanvasElement | null>;
  canvasSize: ComputedRef<PaneSize>;
  camera: ComputedRef<BoardCamera>;
  tiles: ComputedRef<IHexTile[]>;
  /**
   * Bumped by world-map-store.ts's markTileDirty/markTilesDirty/markAllTilesDirty
   * whenever a tile mutates. Watching this instead of deep-watching `tiles`
   * lets the tiles-layer sync recompute just the tiles that actually changed.
   */
  tilesDirtyTick: ComputedRef<number>;
  boardKey: ComputedRef<string | null>;
  heroCoordinates: ComputedRef<IHexCoordinates | null>;
  healTickerNow: Ref<number>;
  movePreview: {
    segments: ComputedRef<IHexCoordinates[]>;
    markerCoord: ComputedRef<IHexCoordinates | null>;
    reachable: ComputedRef<boolean>;
    markerKind: ComputedRef<'move' | 'seen'>;
  };
  squadWatched: ComputedRef<IHexCoordinates[]>;
  onTileHover: (tile: IHexTile, point: TilePointer) => void;
  onTileMove?: (tile: IHexTile, point: TilePointer) => void;
  onTileLeave?: (tile: IHexTile) => void;
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

function portalCoordinates(tiles: IHexTile[]): IHexCoordinates[] {
  return tiles
    .filter((tile) => tile.hexobject?.hexobjectKey === HEXOBJECT_KEYS.RETURN_PORTAL)
    .map((tile) => tile.coordinates);
}

function waitForValidSize(size: ComputedRef<PaneSize>): Promise<PaneSize> {
  return new Promise((resolve) => {
    if (size.value.width > 0 && size.value.height > 0) {
      resolve(size.value);
      return;
    }

    const stop = watch(size, (next) => {
      if (next.width <= 0 || next.height <= 0) return;
      stop();
      resolve(next);
    });
  });
}

export function useHexBoard(opts: UseHexBoardOptions) {
  const worldStore = useWorldMapStore();

  let board: HexBoardApp | null = null;
  let tilesLayer: TilesLayer | null = null;
  let portalLayer: PortalLayer | null = null;
  let heroLayer: HeroLayer | null = null;
  let unregisterPortalFx: (() => void) | null = null;
  let movePreviewLayer: MovePreviewLayer | null = null;
  let squadWatchLayer: SquadWatchLayer | null = null;
  let stopWatchers: Array<() => void> = [];
  let cancelled = false;

  onMounted(async () => {
    const canvas = opts.canvasRef.value;
    if (!canvas) return;

    const initialSize = await waitForValidSize(opts.canvasSize);
    if (cancelled) return;

    board = await createHexBoardApp(canvas, initialSize.width, initialSize.height);
    if (cancelled) {
      board.destroy();
      board = null;
      return;
    }

    tilesLayer = createTilesLayer({
      worldContainer: board.worldContainer,
      getTileSize,
      worldStore,
      onTileHover: opts.onTileHover,
      onTileMove: opts.onTileMove,
      onTileLeave: opts.onTileLeave,
      onTileClick: opts.onTileClick,
      isForceRevealed: () => opts.devPanel?.showWholeBoard.value ?? false,
      getFogLook: () =>
        fogLookForBoardKind(MapRegistry.get(worldStore.currentLocationKey)?.boardKind),
      getZoneTint: (tile) =>
        opts.devPanel?.zoneTintByCoordinateKey.value.get(coordinateKey(tile.coordinates)) ?? null,
    });

    portalLayer = createPortalLayer({
      worldContainer: board.worldContainer,
      getTileSize,
    });

    squadWatchLayer = createSquadWatchLayer({
      worldContainer: board.worldContainer,
      getTileSize,
    });

    heroLayer = createHeroLayer({
      worldContainer: board.worldContainer,
      getTileSize,
    });

    unregisterPortalFx = registerPortalFx({
      enter: (portal) => heroLayer?.playPortalEnter(portal) ?? Promise.resolve(),
      exit: (portal) => heroLayer?.playPortalExit(portal) ?? Promise.resolve(),
      release: () => heroLayer?.releasePortal(),
    });

    movePreviewLayer = createMovePreviewLayer({
      worldContainer: board.worldContainer,
      getTileSize,
    });

    stopWatchers.push(
      watch(
        [opts.canvasSize, opts.camera],
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
          portalLayer?.sync(portalCoordinates(opts.tiles.value), opts.boardKey.value);
          hasFullySynced = true;
          tilesLayer?.syncLockChips(opts.tiles.value, opts.healTickerNow.value);
        },
        { immediate: true },
      ),
    );

    if (opts.devPanel) {
      stopWatchers.push(
        watch([opts.devPanel.showWholeBoard, opts.devPanel.zoneTintByCoordinateKey], () =>
          tilesLayer?.syncTiles(opts.tiles.value),
        ),
      );
    }

    stopWatchers.push(
      watch(opts.tiles, (tiles) => {
        tilesLayer?.syncTiles(tiles);
        portalLayer?.sync(portalCoordinates(tiles), opts.boardKey.value);
      }),
    );

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
          opts.movePreview.markerKind,
        ],
        () => {
          const params: MovePreviewSyncParams = {
            segments: opts.movePreview.segments.value,
            reachable: opts.movePreview.reachable.value,
            markerCoord: opts.movePreview.markerCoord.value,
            markerKind: opts.movePreview.markerKind.value,
          };
          movePreviewLayer?.sync(params);
        },
        { immediate: true, deep: true },
      ),
    );

    stopWatchers.push(
      watch(opts.squadWatched, (next) => squadWatchLayer?.sync(next), { immediate: true }),
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
    unregisterPortalFx?.();
    tilesLayer?.destroy();
    portalLayer?.destroy();
    heroLayer?.destroy();
    movePreviewLayer?.destroy();
    squadWatchLayer?.destroy();
    board?.destroy();
    board = null;
    tilesLayer = null;
    portalLayer = null;
    heroLayer = null;
    movePreviewLayer = null;
    squadWatchLayer = null;
  });
}
