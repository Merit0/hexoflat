import { computed, onBeforeUnmount, onMounted, ref, type ComputedRef } from 'vue';
import { calcHexPixelPosition } from '@hexoflat/engine/utils/hex-utils';

const BLEED = 2;

export interface HexBoardFrame {
  width: number;
  height: number;
}

/** The four corner columns/rows where calcHexPixelPosition's odd-row stagger can produce an extreme x, at both the top and bottom edge. */
function frameCornerCoordinates(frame: HexBoardFrame) {
  const columns = [0, frame.width - 1];
  const rows = [...new Set([0, 1, frame.height - 2, frame.height - 1])].filter(
    (row) => row >= 0 && row < frame.height,
  );
  return rows.flatMap((rowIndex) => columns.map((columnIndex) => ({ columnIndex, rowIndex })));
}

/**
 * DOM-probe tile sizing for the hex board: measures a hidden probe element
 * for the actual rendered tile size (CSS drives this, not JS) and derives
 * the map's pixel bounds from its frame (0..width-1 x 0..height-1) — not
 * from whichever tiles happen to exist, so a sparse board's footprint never
 * jumps as tiles are placed or a void frame edge is reached.
 *
 * There is no per-map scale-to-fit: `scale` is a fixed 1:1, so every hex
 * cell renders at exactly its CSS size (`--hex-tile-*`) on every map — a
 * hex is the same size in camping as in Silesia. A map larger than the
 * `.hex-map` pane overflows and is clipped (centered); pick the map's
 * row/column count so it fits.
 */
export function useHexBoardSizing(frame: ComputedRef<HexBoardFrame | null>) {
  const probeRef = ref<HTMLElement | null>(null);
  const containerRef = ref<HTMLElement | null>(null);
  const domTileW = ref(0);
  const domTileH = ref(0);
  const scale = ref(1);

  function readDomTileSize() {
    const el = probeRef.value;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width > 0) domTileW.value = r.width;
    if (r.height > 0) domTileH.value = r.height;
  }

  const domTileSize = computed(() => ({ w: domTileW.value, h: domTileH.value }));

  const mapBounds = computed(() => {
    const w = domTileW.value || 0;
    const h = domTileH.value || 0;
    const currentFrame = frame.value;

    if (!w || !h || !currentFrame || currentFrame.width <= 0 || currentFrame.height <= 0) {
      return { width: 0, height: 0, offsetX: 0, offsetY: 0 };
    }

    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity;

    for (const coordinates of frameCornerCoordinates(currentFrame)) {
      const { x, y } = calcHexPixelPosition({ coordinates }, w, h);

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    }

    return {
      width: maxX - minX + BLEED * 2,
      height: maxY - minY + BLEED * 2,
      offsetX: minX - BLEED,
      offsetY: minY - BLEED,
    };
  });

  let probeResizeObserver: ResizeObserver | null = null;
  let sizeFallbackTimer: number | null = null;

  onMounted(() => {
    readDomTileSize();

    if (probeRef.value) {
      probeResizeObserver = new ResizeObserver(readDomTileSize);
      probeResizeObserver.observe(probeRef.value);
    }

    sizeFallbackTimer = window.setInterval(() => {
      if (domTileW.value > 0 && domTileH.value > 0) {
        if (sizeFallbackTimer) window.clearInterval(sizeFallbackTimer);
        sizeFallbackTimer = null;
        return;
      }
      readDomTileSize();
    }, 100);
  });

  onBeforeUnmount(() => {
    probeResizeObserver?.disconnect();
    probeResizeObserver = null;
    if (sizeFallbackTimer) {
      window.clearInterval(sizeFallbackTimer);
      sizeFallbackTimer = null;
    }
  });

  return { probeRef, containerRef, domTileW, domTileH, domTileSize, mapBounds, scale };
}
