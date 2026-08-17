import { computed, onBeforeUnmount, onMounted, ref, watch, type ComputedRef, type Ref } from 'vue';
import type { IHexTile } from '@hexoflat/engine/map/models/hex-tile-model';
import { calcHexPixelPosition } from '@hexoflat/engine/utils/hex-utils';

const BLEED = 2;

export interface MapBounds {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

/**
 * The board's pixel box: min/max over the tiles it is given, plus a bleed.
 *
 * Extracted as a pure function because this is the single most expensive
 * silent regression in the exploration slice, and it is not one a rendering
 * test would catch. If `UNKNOWN` hexes stay in here, the board keeps the
 * bounds of the full technical rectangle — the frontier renders organically,
 * but the layout is still 14x9, the camera centres on empty space, and the
 * scale is computed for an area nobody can see. Nothing throws; it just looks
 * subtly wrong forever. Filtering happens in `useHexBoardSizing`, and
 * `use-hex-board-sizing.test.ts` pins both halves of that.
 */
export function computeMapBounds(tiles: IHexTile[], w: number, h: number): MapBounds {
  if (!w || !h) return { width: 0, height: 0, offsetX: 0, offsetY: 0 };

  let minX = Infinity,
    minY = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity;

  for (const t of tiles) {
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
}

/**
 * DOM-probe tile sizing and scale-to-fit for the hex board: measures a
 * hidden probe element for the actual rendered tile size (CSS drives this,
 * not JS), derives the map's pixel bounds from that, and scales the whole
 * board to fit the viewport.
 *
 * `hideUnknown` turns on the exploration slice's organic frontier: `UNKNOWN`
 * hexes stop counting as part of the board at all. It also produces
 * `visibleTiles`, which is what the renderer should be handed — bounds and
 * drawn tiles then come from the same array by construction, so they cannot
 * drift into disagreeing about where the board is.
 *
 * Off by default, and that default is what keeps the pre-slice world maps
 * behaving exactly as before: those start every tile `UNKNOWN` under fog, so
 * filtering them unconditionally would shrink the board to the few hexes
 * around the hero and grow it under the player's feet as they explore.
 */
export function useHexBoardSizing(
  tiles: ComputedRef<IHexTile[]>,
  hideUnknown?: Ref<boolean> | ComputedRef<boolean>,
) {
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

  const visibleTiles = computed(() =>
    hideUnknown?.value ? tiles.value.filter((t) => t.discovery !== 'UNKNOWN') : tiles.value,
  );

  const mapBounds = computed(() =>
    computeMapBounds(visibleTiles.value, domTileW.value || 0, domTileH.value || 0),
  );

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

  return { probeRef, domTileW, domTileH, domTileSize, visibleTiles, mapBounds, scale };
}
