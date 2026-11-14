import { onBeforeUnmount, onMounted, watch, type ComputedRef, type Ref } from 'vue';
import type { DomainEvent } from '@hexoflat/engine/commands/types';
import type {
  BattleCreature,
  BattleHex,
  BattleTerrain,
  Boulder,
} from '@hexoflat/engine/battle/battle-state';
import {
  battleHexToOffset,
  BATTLEFIELD_BIOMES,
  type BattlefieldBiome,
} from '@hexoflat/engine/battle/battlefield';
import { calcHexPixelPosition } from '@hexoflat/engine/utils/hex-utils';
import { createHexBoardApp, type HexBoardApp } from '@/render/pixi-app';
import {
  HEX_WORLD_HEIGHT,
  HEX_WORLD_WIDTH,
  fitAtReferenceZoom,
  frameWorldRect,
  worldToScreen,
  type BoardCamera,
  type BoardFrame,
} from '@/render/board-camera';
import { preloadTextures } from '@/render/texture-cache';
import { preloadBloodSplash } from '@/render/blood-splash';
import { battleAssetPaths } from '@/render/battle/battle-look';
import { registerBattleHexProbe } from '@/e2e/battle-hooks';
import { createBattleSyncGate } from '@/render/battle/battle-sync-gate';
import type { ProjectedCollect } from '@hexoflat/engine/battle/projection';
import { coordinateKey } from '@hexoflat/engine/utils/hex-utils';
import { createBattleLootLayer, type BattleLootLayer } from '@/render/layers/battle-loot-layer';
import { createLootFlightLayer, type LootFlightLayer } from '@/render/layers/loot-flight-layer';
import { isLootFlightPending, landLootFlight } from '@/services/loot/loot-flight-state';
import { createGraveFlights } from './grave-flights';
import type { TileAnchor } from '@/render/layers/tiles-layer';
import { createBattleBoardLayer, type BattleBoardLayer } from '@/render/layers/battle-board-layer';
import {
  createBattleOverlayLayer,
  type BattleOverlayLayer,
} from '@/render/layers/battle-overlay-layer';
import {
  createBattleDamageLayer,
  type BattleDamageLayer,
} from '@/render/layers/battle-damage-layer';
import { createBattleFxLayer, type BattleFxLayer } from '@/render/layers/battle-fx-layer';
import { createBattleTokenLayer, type BattleTokenLayer } from '@/render/layers/battle-token-layer';
import { createMovePreviewLayer, type MovePreviewLayer } from '@/render/layers/move-preview-layer';
import type { BattleMovePreview } from '@/composables/battle-board-tap';
import { createBattleAnimator, type BattleAnimator } from './battle-animator';
import type { BattleOverlayModel } from './battle-overlay-model';

export interface BattleBoardScene {
  biome: BattlefieldBiome;
  board: Record<string, BattleTerrain>;
  boulders: Boulder[];
  creatures: BattleCreature[];
  activeId: string | null;
  collect: ProjectedCollect | null;
}

export interface UseBattleBoardOptions {
  pane: Ref<HTMLElement | null>;
  canvas: Ref<HTMLCanvasElement | null>;
  scene: ComputedRef<BattleBoardScene>;
  overlay: ComputedRef<BattleOverlayModel>;
  preview: ComputedRef<BattleMovePreview | null>;
  referenceFrame?: ComputedRef<BoardFrame | null>;
  onReady?: () => void;
  onHexTap?: (hex: BattleHex) => void;
  onHexHover?: (hex: BattleHex) => void;
  onHexPointer?: (hex: BattleHex | null, anchor: TileAnchor | null) => void;
  takeEvents?: () => DomainEvent[];
  onAnimating?: (busy: boolean) => void;
  onCamera?: (camera: BoardCamera) => void;
}

interface Layers {
  board: BattleBoardLayer;
  tokens: BattleTokenLayer;
  loot: BattleLootLayer;
  flight: LootFlightLayer;
  overlay: BattleOverlayLayer;
  preview: MovePreviewLayer;
  fx: BattleFxLayer;
  damage: BattleDamageLayer;
  animator: BattleAnimator;
}

export function useBattleBoard(options: UseBattleBoardOptions): void {
  let pixi: HexBoardApp | null = null;
  let layers: Layers | null = null;
  let observer: ResizeObserver | null = null;
  let destroyed = false;

  const positionOf = (hex: BattleHex) =>
    calcHexPixelPosition(
      { coordinates: battleHexToOffset(options.scene.value.biome, hex) },
      HEX_WORLD_WIDTH,
      HEX_WORLD_HEIGHT,
    );

  let paneSize = { width: 0, height: 0 };
  let currentCamera: BoardCamera | null = null;

  function fit(width: number, height: number) {
    if (!pixi) return;
    paneSize = { width, height };
    const { frame } = BATTLEFIELD_BIOMES[options.scene.value.biome];
    const reference = options.referenceFrame?.value ?? null;
    pixi.resize(width, height);
    const camera = fitAtReferenceZoom({
      frameRect: frameWorldRect({ width: frame.columns, height: frame.rows }),
      referenceRect: reference ? frameWorldRect(reference) : null,
      pane: { width, height },
    });
    pixi.setCamera(camera);
    currentCamera = camera;
    options.onCamera?.(camera);
    pixi.renderNow();
  }

  const syncGate = createBattleSyncGate();
  const offsetOf = (hex: BattleHex) => battleHexToOffset(options.scene.value.biome, hex);
  const graveFlights = createGraveFlights({
    offsetOf,
    flightLayer: () => layers?.flight ?? null,
    onBusy: (busy) => options.onAnimating?.(busy),
  });

  function syncAll() {
    if (!layers) return;
    const scene = options.scene.value;
    const overlay = options.overlay.value;
    const changed = syncGate.diff(scene, overlay);
    if (changed.board) {
      layers.board.sync({ biome: scene.biome, board: scene.board, boulders: scene.boulders });
    }
    if (changed.overlay) layers.overlay.sync(overlay);
    syncPreview();
    const events = options.takeEvents?.() ?? [];
    graveFlights.start(events);
    if (changed.loot) layers.loot.sync(scene.collect?.items ?? []);
    if (changed.tokens) {
      layers.tokens.sync(scene.creatures, scene.activeId, overlay.targets, scene.collect?.graves);
    }
    if (events.length) layers.animator.play(events, scene.creatures);
  }

  function syncPreview() {
    if (!layers) return;
    const preview = options.preview.value;
    const biome = options.scene.value.biome;
    const segments = (preview?.path ?? []).map((hex) => battleHexToOffset(biome, hex));
    layers.preview.sync({
      segments,
      reachable: preview?.reachable ?? false,
      markerCoord: null,
      markerKind: 'move',
    });
  }

  function createLayers(app: HexBoardApp): Layers {
    const deps = {
      worldContainer: app.worldContainer,
      ticker: app.app.ticker,
      tileSize: { w: HEX_WORLD_WIDTH, h: HEX_WORLD_HEIGHT },
      positionOf,
      onHexTap: options.onHexTap,
      onHexHover: options.onHexHover,
      onHexPointer: options.onHexPointer,
    };
    const board = createBattleBoardLayer(deps);
    const overlay = createBattleOverlayLayer(deps);
    const preview = createMovePreviewLayer({
      worldContainer: app.worldContainer,
      getTileSize: () => ({ w: HEX_WORLD_WIDTH, h: HEX_WORLD_HEIGHT }),
    });
    const loot = createBattleLootLayer({
      worldContainer: app.worldContainer,
      tileSize: deps.tileSize,
      positionOf,
      isHidden: (hex) => isLootFlightPending(coordinateKey(offsetOf(hex))),
    });
    const tokens = createBattleTokenLayer(deps);
    const fx = createBattleFxLayer(deps);
    const damage = createBattleDamageLayer(deps);
    const animator = createBattleAnimator({
      ticker: app.app.ticker,
      geometry: {
        centreOf: (hex) => {
          const { x, y } = positionOf(hex);
          return { x: x + HEX_WORLD_WIDTH / 2, y: y + HEX_WORLD_HEIGHT / 2 };
        },
        tileHeight: HEX_WORLD_HEIGHT,
      },
      tokens,
      overlay,
      fx,
      damage,
      onBusyChange: (busy) => graveFlights.setAnimatorBusy(busy),
    });
    const flight = createLootFlightLayer({
      worldContainer: app.worldContainer,
      getTileSize: () => deps.tileSize,
      onLanded: (landed) => {
        if (landed.landingKey) landLootFlight(landed.landingKey);
        loot.refresh();
      },
    });
    return { board, overlay, preview, tokens, loot, flight, fx, damage, animator };
  }

  async function start(width: number, height: number) {
    const canvas = options.canvas.value;
    if (!canvas || pixi) return;
    const app = await createHexBoardApp(canvas, width, height);
    if (destroyed) {
      app.destroy();
      return;
    }
    await Promise.all([
      preloadTextures(battleAssetPaths(options.scene.value.biome)),
      preloadBloodSplash(),
    ]);
    if (destroyed) {
      app.destroy();
      return;
    }
    pixi = app;
    options.takeEvents?.();
    layers = createLayers(app);
    syncAll();
    fit(width, height);
    if (import.meta.env.VITE_E2E_HOOKS === 'true') {
      registerBattleHexProbe((hex) => {
        if (!currentCamera) return null;
        const { x, y } = positionOf(hex);
        return worldToScreen(currentCamera, {
          x: x + HEX_WORLD_WIDTH / 2,
          y: y + HEX_WORLD_HEIGHT / 2,
        });
      });
    }
    app.onFirstFramePresented(() => options.onReady?.());
  }

  onMounted(() => {
    const pane = options.pane.value;
    if (!pane) return;
    observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width <= 0 || height <= 0) return;
      if (pixi) fit(width, height);
      else void start(width, height);
    });
    observer.observe(pane);
  });

  watch([options.scene, options.overlay], () => {
    syncAll();
    pixi?.renderNow();
  });

  if (options.referenceFrame) {
    watch(options.referenceFrame, () => fit(paneSize.width, paneSize.height));
  }

  watch(options.preview, () => {
    syncPreview();
    pixi?.renderNow();
  });

  onBeforeUnmount(() => {
    destroyed = true;
    if (import.meta.env.VITE_E2E_HOOKS === 'true') registerBattleHexProbe(null);
    observer?.disconnect();
    layers?.animator.destroy();
    layers?.fx.destroy();
    layers?.damage.destroy();
    layers?.preview.destroy();
    layers?.board.destroy();
    layers?.overlay.destroy();
    layers?.tokens.destroy();
    layers?.loot.destroy();
    layers?.flight.destroy();
    pixi?.destroy();
    pixi = null;
    layers = null;
  });
}
