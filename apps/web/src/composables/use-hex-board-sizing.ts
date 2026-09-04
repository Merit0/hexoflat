import { computed, onBeforeUnmount, onMounted, ref, type ComputedRef } from 'vue';
import type { IHexTile } from '@hexoflat/engine/map/models/hex-tile-model';
import { calcHexPixelPosition } from '@hexoflat/engine/utils/hex-utils';

const BLEED = 2;

/**
 * DOM-probe tile sizing for the hex board: measures a hidden probe element
 * for the actual rendered tile size (CSS drives this, not JS) and derives
 * the map's pixel bounds from that.
 *
 * There is no per-map scale-to-fit: `scale` is a fixed 1:1, so every hex
 * cell renders at exactly its CSS size (`--hex-tile-*`) on every map — a
 * hex is the same size in camping as in Silesia. A map larger than the
 * `.hex-map` pane overflows and is clipped (centered); pick the map's
 * row/column count so it fits.
 */
export function useHexBoardSizing(tiles: ComputedRef<IHexTile[]>) {
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

    if (!w || !h) {
      return { width: 0, height: 0, offsetX: 0, offsetY: 0 };
    }

    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity;

    for (const t of tiles.value) {
      const { x, y } = calcHexPixelPosition(t, w, h);

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    }

    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
      return { width: 0, height: 0, offsetX: 0, offsetY: 0 };
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
