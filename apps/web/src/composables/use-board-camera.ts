import { computed, onBeforeUnmount, onMounted, ref, type ComputedRef } from 'vue';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import {
  fitBoardCamera,
  frameWorldRect,
  IDENTITY_CAMERA,
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
  const paneWidth = ref(0);
  const paneHeight = ref(0);

  function readPaneSize() {
    const el = containerRef.value;
    if (!el) return;
    paneWidth.value = el.clientWidth;
    paneHeight.value = el.clientHeight;
  }

  const paneSize = computed(() => ({ width: paneWidth.value, height: paneHeight.value }));

  const frameRect = computed(() => {
    const current = frame.value;
    if (!current || current.width <= 0 || current.height <= 0) return null;
    return frameWorldRect(current);
  });

  const camera = computed(() => {
    const rect = frameRect.value;
    if (!rect) return IDENTITY_CAMERA;
    return fitBoardCamera({
      frameRect: rect,
      pane: paneSize.value,
      focus: focus.value ? tileWorldCenter(focus.value) : null,
    });
  });

  const screenTileSize = computed(() => tileScreenSize(camera.value));

  let paneResizeObserver: ResizeObserver | null = null;
  let panePollTimer: number | null = null;

  function stopPolling() {
    if (panePollTimer) window.clearInterval(panePollTimer);
    panePollTimer = null;
  }

  onMounted(() => {
    readPaneSize();

    if (containerRef.value) {
      paneResizeObserver = new ResizeObserver(readPaneSize);
      paneResizeObserver.observe(containerRef.value);
    }

    panePollTimer = window.setInterval(() => {
      if (paneWidth.value > 0 && paneHeight.value > 0) {
        stopPolling();
        return;
      }
      readPaneSize();
    }, PANE_POLL_INTERVAL_MS);
  });

  onBeforeUnmount(() => {
    paneResizeObserver?.disconnect();
    paneResizeObserver = null;
    stopPolling();
  });

  return { containerRef, paneWidth, paneHeight, paneSize, frameRect, camera, screenTileSize };
}
