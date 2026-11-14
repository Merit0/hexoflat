import { onBeforeUnmount, onMounted, watch, type ComputedRef, type Ref } from 'vue';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { BATTLEFIELD_BIOMES } from '@hexoflat/engine/battle/battlefield';
import { calcHexPixelPosition } from '@hexoflat/engine/utils/hex-utils';
import { createHexBoardApp, type HexBoardApp } from '@/render/pixi-app';
import {
  HEX_WORLD_HEIGHT,
  HEX_WORLD_WIDTH,
  fitBoardCamera,
  type BoardCamera,
  type WorldRect,
} from '@/render/board-camera';
import { preloadTextures } from '@/render/texture-cache';
import type { TileAnchor } from '@/render/layers/tiles-layer';
import {
  createQuestNumbersLayer,
  questLayerAssetPaths,
  type QuestNumbersLayer,
} from '@/render/layers/quest-numbers-layer';
import { createLootFlightLayer, type LootFlightLayer } from '@/render/layers/loot-flight-layer';
import {
  finishLootFlights,
  isLootFlightPending,
  landLootFlight,
  lootFlightRequest,
} from '@/services/loot/loot-flight-state';
import { registerQuestHexProbe } from '@/e2e/quest-hooks';
import { tileWorldCenter, worldToScreen } from '@/render/board-camera';
import { fieldHexagon, type QuestFieldModel } from '@/services/quests/quest-field-model';

export interface UseQuestBoardOptions {
  pane: Ref<HTMLElement | null>;
  canvas: Ref<HTMLCanvasElement | null>;
  model: ComputedRef<QuestFieldModel>;
  onReady?: () => void;
  onHexTap?: (hex: IHexCoordinates) => void;
  onHexPointer?: (hex: IHexCoordinates | null, anchor: TileAnchor | null) => void;
  onCamera?: (camera: BoardCamera) => void;
}

const FLOOR = BATTLEFIELD_BIOMES.crypt.background;

export function fieldWorldRect(): WorldRect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const coordinates of fieldHexagon()) {
    const { x, y } = calcHexPixelPosition({ coordinates }, HEX_WORLD_WIDTH, HEX_WORLD_HEIGHT);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + HEX_WORLD_WIDTH);
    maxY = Math.max(maxY, y + HEX_WORLD_HEIGHT);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function useQuestBoard(options: UseQuestBoardOptions): void {
  let pixi: HexBoardApp | null = null;
  let layer: QuestNumbersLayer | null = null;
  let flightLayer: LootFlightLayer | null = null;
  let observer: ResizeObserver | null = null;
  let destroyed = false;
  let currentCamera: BoardCamera | null = null;
  const frameRect = fieldWorldRect();

  function fit(width: number, height: number) {
    if (!pixi) return;
    pixi.resize(width, height);
    const camera = fitBoardCamera({ frameRect, pane: { width, height } });
    pixi.setCamera(camera);
    currentCamera = camera;
    options.onCamera?.(camera);
    pixi.renderNow();
  }

  function sync() {
    layer?.sync(options.model.value);
    pixi?.renderNow();
  }

  async function start(width: number, height: number) {
    const canvas = options.canvas.value;
    if (!canvas || pixi) return;
    const app = await createHexBoardApp(canvas, width, height);
    if (destroyed) {
      app.destroy();
      return;
    }
    await preloadTextures(questLayerAssetPaths(FLOOR));
    if (destroyed) {
      app.destroy();
      return;
    }
    pixi = app;
    layer = createQuestNumbersLayer({
      worldContainer: app.worldContainer,
      tileSize: { w: HEX_WORLD_WIDTH, h: HEX_WORLD_HEIGHT },
      positionOf: (coordinates) =>
        calcHexPixelPosition({ coordinates }, HEX_WORLD_WIDTH, HEX_WORLD_HEIGHT),
      floorSprite: FLOOR,
      isHidden: isLootFlightPending,
      onHexTap: options.onHexTap,
      onHexPointer: options.onHexPointer,
    });
    layer.sync(options.model.value);
    flightLayer = createLootFlightLayer({
      worldContainer: app.worldContainer,
      getTileSize: () => ({ w: HEX_WORLD_WIDTH, h: HEX_WORLD_HEIGHT }),
      onLanded: (flight) => {
        if (flight.landingKey) landLootFlight(flight.landingKey);
        layer?.resync();
        pixi?.renderNow();
      },
    });
    fit(width, height);
    playPending(lootFlightRequest.value);
    if (import.meta.env.VITE_E2E_HOOKS === 'true') {
      registerQuestHexProbe((hex) =>
        currentCamera ? worldToScreen(currentCamera, tileWorldCenter(hex)) : null,
      );
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

  function playPending(request: typeof lootFlightRequest.value) {
    if (!request || !flightLayer) return;
    void flightLayer.play(request).then(() => finishLootFlights(request.id));
  }

  watch(options.model, sync);
  watch(lootFlightRequest, playPending);

  onBeforeUnmount(() => {
    destroyed = true;
    if (import.meta.env.VITE_E2E_HOOKS === 'true') registerQuestHexProbe(null);
    observer?.disconnect();
    flightLayer?.destroy();
    layer?.destroy();
    pixi?.destroy();
    pixi = null;
    layer = null;
    flightLayer = null;
  });
}
