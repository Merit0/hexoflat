import { computed, onBeforeUnmount, onMounted, ref, watch, type ComputedRef } from 'vue';
import type { IHexTile } from '@hexoflat/engine/map/models/hex-tile-model';
import { calcHexPixelPosition } from '@hexoflat/engine/utils/hex-utils';

const BLEED = 2;

/**
 * DOM-probe tile sizing and scale-to-fit for the hex board: measures a
 * hidden probe element for the actual rendered tile size (CSS drives this,
 * not JS), derives the map's pixel bounds from that, and scales the whole
 * board to fit its own container — the `.hex-map` pane, measured via
 * ResizeObserver rather than `window.innerWidth`/`innerHeight`, since the
 * map only ever occupies a fraction of the viewport (the desktop 70/30
 * split from use-game-layout.ts).
 */
export function useHexBoardSizing(tiles: ComputedRef<IHexTile[]>) {
  const probeRef = ref<HTMLElement | null>(null);
  const containerRef = ref<HTMLElement | null>(null);
  const domTileW = ref(0);
  const domTileH = ref(0);
  const containerWidth = ref(0);
  const containerHeight = ref(0);

  function readDomTileSize() {
    const el = probeRef.value;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width > 0) domTileW.value = r.width;
    if (r.height > 0) domTileH.value = r.height;
  }

  function readContainerSize() {
    const el = containerRef.value;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width > 0) containerWidth.value = r.width;
    if (r.height > 0) containerHeight.value = r.height;
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

  const scale = ref(1);

  function updateScale() {
    const b = mapBounds.value;
    if (!b.width || !b.height) return;
    if (!containerWidth.value || !containerHeight.value) return;

    const padding = 40;
    const sx = (containerWidth.value - padding) / b.width;
    const sy = (containerHeight.value - padding) / b.height;

    scale.value = Math.min(sx, sy, 1.1);
  }

  let probeResizeObserver: ResizeObserver | null = null;
  let containerResizeObserver: ResizeObserver | null = null;
  let sizeFallbackTimer: number | null = null;

  watch(mapBounds, updateScale, { immediate: true });

  onMounted(() => {
    if (probeRef.value) {
      probeResizeObserver = new ResizeObserver(() => {
        readDomTileSize();
        updateScale();
      });
      probeResizeObserver.observe(probeRef.value);
    }

    if (containerRef.value) {
      containerResizeObserver = new ResizeObserver(() => {
        readContainerSize();
        updateScale();
      });
      containerResizeObserver.observe(containerRef.value);
    }

    sizeFallbackTimer = window.setInterval(() => {
      const haveTileSize = domTileW.value > 0 && domTileH.value > 0;
      const haveContainerSize = containerWidth.value > 0 && containerHeight.value > 0;
      if (haveTileSize && haveContainerSize) {
        if (sizeFallbackTimer) window.clearInterval(sizeFallbackTimer);
        sizeFallbackTimer = null;
        return;
      }
      readDomTileSize();
      readContainerSize();
      updateScale();
    }, 100);
  });

  onBeforeUnmount(() => {
    probeResizeObserver?.disconnect();
    probeResizeObserver = null;
    containerResizeObserver?.disconnect();
    containerResizeObserver = null;
    if (sizeFallbackTimer) {
      window.clearInterval(sizeFallbackTimer);
      sizeFallbackTimer = null;
    }
  });

  return { probeRef, containerRef, domTileW, domTileH, domTileSize, mapBounds, scale };
}
