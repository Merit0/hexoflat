import { onBeforeUnmount, onMounted, watch, type ComputedRef, type Ref } from 'vue';
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
  fitBoardCamera,
  frameWorldRect,
} from '@/render/board-camera';
import { createBattleBoardLayer, type BattleBoardLayer } from '@/render/layers/battle-board-layer';
import {
  createBattleOverlayLayer,
  type BattleOverlayLayer,
} from '@/render/layers/battle-overlay-layer';
import { createBattleTokenLayer, type BattleTokenLayer } from '@/render/layers/battle-token-layer';
import type { BattleOverlayModel } from './battle-overlay-model';

export interface BattleBoardScene {
  biome: BattlefieldBiome;
  board: Record<string, BattleTerrain>;
  boulders: Boulder[];
  creatures: BattleCreature[];
  activeId: string | null;
}

export interface UseBattleBoardOptions {
  pane: Ref<HTMLElement | null>;
  canvas: Ref<HTMLCanvasElement | null>;
  scene: ComputedRef<BattleBoardScene>;
  overlay: ComputedRef<BattleOverlayModel>;
  onReady?: () => void;
}

interface Layers {
  board: BattleBoardLayer;
  tokens: BattleTokenLayer;
  overlay: BattleOverlayLayer;
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

  function fit(width: number, height: number) {
    if (!pixi) return;
    const { frame } = BATTLEFIELD_BIOMES[options.scene.value.biome];
    pixi.resize(width, height);
    pixi.setCamera(
      fitBoardCamera({
        frameRect: frameWorldRect({ width: frame.columns, height: frame.rows }),
        pane: { width, height },
      }),
    );
    pixi.renderNow();
  }

  function syncAll() {
    if (!layers) return;
    const scene = options.scene.value;
    layers.board.sync({ board: scene.board, boulders: scene.boulders });
    layers.overlay.sync(options.overlay.value);
    layers.tokens.sync(scene.creatures, scene.activeId);
  }

  async function start(width: number, height: number) {
    const canvas = options.canvas.value;
    if (!canvas || pixi) return;
    const app = await createHexBoardApp(canvas, width, height);
    if (destroyed) {
      app.destroy();
      return;
    }
    pixi = app;
    const deps = {
      worldContainer: app.worldContainer,
      ticker: app.app.ticker,
      tileSize: { w: HEX_WORLD_WIDTH, h: HEX_WORLD_HEIGHT },
      positionOf,
    };
    layers = {
      board: createBattleBoardLayer(deps),
      overlay: createBattleOverlayLayer(deps),
      tokens: createBattleTokenLayer(deps),
    };
    syncAll();
    fit(width, height);
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

  onBeforeUnmount(() => {
    destroyed = true;
    observer?.disconnect();
    layers?.board.destroy();
    layers?.overlay.destroy();
    layers?.tokens.destroy();
    pixi?.destroy();
    pixi = null;
    layers = null;
  });
}
