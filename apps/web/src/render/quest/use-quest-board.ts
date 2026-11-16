import { watch, type ComputedRef, type Ref } from 'vue';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { calcHexPixelPosition } from '@hexoflat/engine/utils/hex-utils';
import type { HexBoardApp } from '@/render/pixi-app';
import { useObservedBoardApp } from '@/render/use-observed-board-app';
import {
  HEX_WORLD_HEIGHT,
  HEX_WORLD_WIDTH,
  fitAtReferenceZoom,
  frameWorldRect,
  snapCameraToPixels,
  type BoardFrame,
  type BoardCamera,
  type PaneSize,
  type WorldRect,
} from '@/render/board-camera';
import { preloadTextures } from '@/render/texture-cache';
import type { TileAnchor } from '@/render/layers/tiles-layer';
import {
  createQuestNumbersLayer,
  questLayerAssetPaths,
  type QuestNumbersLayer,
} from '@/render/layers/quest-numbers-layer';
import { createHeroLayer, type HeroLayer } from '@/render/layers/hero-layer';
import { createLootFlightLayer, type LootFlightLayer } from '@/render/layers/loot-flight-layer';
import {
  finishLootFlights,
  isLootFlightPending,
  landLootFlight,
  lootFlightRequest,
} from '@/services/loot/loot-flight-state';
import { registerQuestHexProbe } from '@/e2e/quest-hooks';
import { tileWorldCenter, worldToScreen } from '@/render/board-camera';
import { type QuestFieldModel } from '@/services/quests/quest-field-model';

export interface UseQuestBoardOptions {
  pane: Ref<HTMLElement | null>;
  canvas: Ref<HTMLCanvasElement | null>;
  model: ComputedRef<QuestFieldModel>;
  referenceFrame?: ComputedRef<BoardFrame | null>;
  onReady?: () => void;
  onHexTap?: (hex: IHexCoordinates) => void;
  onHexPointer?: (hex: IHexCoordinates | null, anchor: TileAnchor | null) => void;
  onCamera?: (camera: BoardCamera) => void;
}

const LEGACY_FLOOR = '/hex-assets/board-hexes/stone-hex.png';

export function fieldWorldRect(model: QuestFieldModel): WorldRect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const coordinatesOf = [
    ...model.fog,
    ...model.hexes.map(({ hex }) => hex),
    ...model.border.map(({ hex }) => hex),
    ...model.terrain.map(({ hex }) => hex),
  ];
  if (!coordinatesOf.length)
    return { x: 0, y: 0, width: HEX_WORLD_WIDTH, height: HEX_WORLD_HEIGHT };
  for (const coordinates of coordinatesOf) {
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
  let heroLayer: HeroLayer | null = null;
  let floor = LEGACY_FLOOR;
  let currentCamera: BoardCamera | null = null;
  let paneSize = { width: 0, height: 0 };
  const frameRect = () => fieldWorldRect(options.model.value);

  function fit(width: number, height: number) {
    if (!pixi || width <= 0 || height <= 0) return;
    if (paneSize.width !== width || paneSize.height !== height) pixi.resize(width, height);
    paneSize = { width, height };
    const reference = options.referenceFrame?.value;
    const camera = snapCameraToPixels(
      fitAtReferenceZoom({
        frameRect: frameRect(),
        referenceRect: reference ? frameWorldRect(reference) : null,
        pane: paneSize,
        focus: tileWorldCenter(options.model.value.position),
      }),
      window.devicePixelRatio || 1,
    );
    pixi.setCamera(camera);
    currentCamera = camera;
    options.onCamera?.(camera);
    pixi.renderNow();
  }

  function sync() {
    layer?.sync(options.model.value);
    heroLayer?.syncHero(options.model.value.position);
    pixi?.renderNow();
  }

  function prepare() {
    floor = options.model.value.background ?? LEGACY_FLOOR;
    return preloadTextures(questLayerAssetPaths(floor));
  }

  function start(app: HexBoardApp, { width, height }: PaneSize) {
    pixi = app;
    layer = createQuestNumbersLayer({
      worldContainer: app.worldContainer,
      tileSize: { w: HEX_WORLD_WIDTH, h: HEX_WORLD_HEIGHT },
      positionOf: (coordinates) =>
        calcHexPixelPosition({ coordinates }, HEX_WORLD_WIDTH, HEX_WORLD_HEIGHT),
      floorSprite: floor,
      isHidden: isLootFlightPending,
      onHexTap: options.onHexTap,
      onHexPointer: options.onHexPointer,
    });
    layer.sync(options.model.value);
    heroLayer = createHeroLayer({
      worldContainer: app.worldContainer,
      getTileSize: () => ({ w: HEX_WORLD_WIDTH, h: HEX_WORLD_HEIGHT }),
    });
    heroLayer.syncHero(options.model.value.position);
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

  function dispose() {
    if (import.meta.env.VITE_E2E_HOOKS === 'true') registerQuestHexProbe(null);
    finishLootFlights();
    flightLayer?.destroy();
    heroLayer?.destroy();
    layer?.destroy();
    pixi = null;
    layer = null;
    flightLayer = null;
    heroLayer = null;
  }

  useObservedBoardApp({
    pane: options.pane,
    canvas: options.canvas,
    prepare,
    onStart: start,
    onResize: ({ width, height }) => fit(width, height),
    onDispose: dispose,
  });

  function playPending(request: typeof lootFlightRequest.value) {
    if (!request || !flightLayer) return;
    void flightLayer.play(request).then(() => finishLootFlights(request.id));
  }

  watch(options.model, sync);
  watch(
    () => options.model.value.position,
    () => fit(paneSize.width, paneSize.height),
  );
  if (options.referenceFrame)
    watch(options.referenceFrame, () => fit(paneSize.width, paneSize.height));
  watch(lootFlightRequest, playPending);
}
