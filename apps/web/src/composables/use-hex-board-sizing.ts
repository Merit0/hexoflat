import { computed, onBeforeUnmount, onMounted, ref, watch, type ComputedRef } from 'vue';
import type { IHexTile } from '@hexoflat/engine/map/models/hex-tile-model';
import { calcHexPixelPosition } from '@hexoflat/engine/utils/hex-utils';

const BLEED = 2;

/**
 * DOM-probe tile sizing and scale-to-fit for the hex board: measures a
 * hidden probe element for the actual rendered tile size (CSS drives this,
 * not JS), derives the map's pixel bounds from that, and scales the whole
 * board to fit the viewport.
 */
export function useHexBoardSizing(tiles: ComputedRef<IHexTile[]>) {
  const probeRef = ref<HTMLElement | null>(null);
  const domTileW = ref(0);
  const domTileH = ref(0);

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

  const scale = ref(1);

  function updateScale() {
    const b = mapBounds.value;
    if (!b.width || !b.height) return;

    const padding = 40;
    const topbar = 64; // keep some space; map container already padded, this just helps scale
    const sx = (window.innerWidth - padding) / b.width;
    const sy = (window.innerHeight - padding - topbar) / b.height;

    scale.value = Math.min(sx, sy, 1.1);
  }

  function onResize() {
    readDomTileSize();
    updateScale();
  }

  let probeResizeObserver: ResizeObserver | null = null;
  let probeSizeFallbackTimer: number | null = null;

  watch(mapBounds, updateScale, { immediate: true });

  onMounted(() => {
    // A single requestAnimationFrame read of the probe's box isn't reliable —
    // if layout (fonts, viewport, scrollbars) hasn't settled on that exact
    // frame, `readDomTileSize` silently measures 0 once and nothing ever
    // retries, leaving domTileW/H (and everything downstream: mapBounds, the
    // Pixi canvas size, every tile's hit-test area) stuck at zero for the rest
    // of the page's life — tiles render in the wrong place or clicks silently
    // do nothing until a reload happens to win the race. A ResizeObserver
    // fires as soon as the probe actually has a size, and again on every
    // subsequent change, so this self-heals instead of gambling on one frame.
    if (probeRef.value) {
      probeResizeObserver = new ResizeObserver(() => {
        readDomTileSize();
        updateScale();
      });
      probeResizeObserver.observe(probeRef.value);
    }

    // Bounded fallback: ResizeObserver fires almost immediately in a healthy
    // tab, but if that very first layout/paint tick is delayed for any reason
    // (backgrounded tab, heavy load), poll briefly until domTileSize is real
    // instead of depending entirely on that one callback ever arriving.
    probeSizeFallbackTimer = window.setInterval(() => {
      if (domTileW.value > 0 && domTileH.value > 0) {
        if (probeSizeFallbackTimer) window.clearInterval(probeSizeFallbackTimer);
        probeSizeFallbackTimer = null;
        return;
      }
      readDomTileSize();
      updateScale();
    }, 100);

    window.addEventListener('resize', onResize);
  });

  onBeforeUnmount(() => {
    probeResizeObserver?.disconnect();
    probeResizeObserver = null;
    if (probeSizeFallbackTimer) {
      window.clearInterval(probeSizeFallbackTimer);
      probeSizeFallbackTimer = null;
    }
    window.removeEventListener('resize', onResize);
  });

  return { probeRef, domTileW, domTileH, domTileSize, mapBounds, scale };
}
