import { computed, onBeforeUnmount, onMounted, ref, type ComputedRef } from 'vue';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import {
  fitBoardCamera,
  frameWorldRect,
  IDENTITY_CAMERA,
  snapCameraToPixels,
  tileScreenSize,
  tileWorldCenter,
  type BoardFrame,
} from '@/render/board-camera';

const PANE_POLL_INTERVAL_MS = 100;

export function useBoardCamera(
  frame: ComputedRef<BoardFrame | null>,
  focus: ComputedRef<IHexCoordinates | null>,
) {
  const containerRef = ref<HTMLElement | null>(null);
  const stageRef = ref<HTMLElement | null>(null);
  const paneWidth = ref(0);
  const paneHeight = ref(0);
  const stageWidth = ref(0);
  const pixelRatio = ref(1);

  function readSizes() {
    const pane = containerRef.value;
    if (pane) {
      paneWidth.value = pane.clientWidth;
      paneHeight.value = pane.clientHeight;
    }
    if (stageRef.value) stageWidth.value = stageRef.value.clientWidth;
    pixelRatio.value = window.devicePixelRatio || 1;
  }

  const paneSize = computed(() => ({ width: paneWidth.value, height: paneHeight.value }));

  const canvasSize = computed(() => ({
    width: Math.max(stageWidth.value, paneWidth.value),
    height: paneHeight.value,
  }));

  const frameRect = computed(() => {
    const current = frame.value;
    if (!current || current.width <= 0 || current.height <= 0) return null;
    return frameWorldRect(current);
  });

  const camera = computed(() => {
    const rect = frameRect.value;
    if (!rect) return IDENTITY_CAMERA;
    const fitted = fitBoardCamera({
      frameRect: rect,
      pane: paneSize.value,
      focus: focus.value ? tileWorldCenter(focus.value) : null,
    });
    return snapCameraToPixels(fitted, pixelRatio.value);
  });

  const screenTileSize = computed(() => tileScreenSize(camera.value));

  let sizeObserver: ResizeObserver | null = null;
  let sizePollTimer: number | null = null;

  function stopPolling() {
    if (sizePollTimer) window.clearInterval(sizePollTimer);
    sizePollTimer = null;
  }

  onMounted(() => {
    readSizes();

    sizeObserver = new ResizeObserver(readSizes);
    if (containerRef.value) sizeObserver.observe(containerRef.value);
    if (stageRef.value) sizeObserver.observe(stageRef.value);

    sizePollTimer = window.setInterval(() => {
      if (paneWidth.value > 0 && paneHeight.value > 0) {
        stopPolling();
        return;
      }
      readSizes();
    }, PANE_POLL_INTERVAL_MS);
  });

  onBeforeUnmount(() => {
    sizeObserver?.disconnect();
    sizeObserver = null;
    stopPolling();
  });

  return {
    containerRef,
    stageRef,
    paneWidth,
    paneHeight,
    stageWidth,
    paneSize,
    canvasSize,
    frameRect,
    camera,
    screenTileSize,
  };
}
