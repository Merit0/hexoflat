import { computed, onBeforeUnmount, onMounted, ref, watch, type ComputedRef } from 'vue';
import type { IHexTile } from '@hexoflat/engine/map/models/hex-tile-model';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { calcHexPixelPosition } from '@hexoflat/engine/utils/hex-utils';

const BLEED = 2;
const SMOOTH_TAU_MS = 95;
const SETTLE_PX = 0.1;

/**
 * DOM-probe tile sizing and a fixed-zoom hero-follow camera for the hex
 * board. The tile size comes from a hidden probe element (CSS drives it, not
 * JS) and never changes with the map — the board renders at scale 1 and the
 * camera continuously eases toward the hero's centred position with a
 * frame-rate-independent exponential smooth, so multi-step movement glides
 * instead of stepping.
 */
export function useHexBoardSizing(
  tiles: ComputedRef<IHexTile[]>,
  extraPoints?: ComputedRef<IHexCoordinates[]>,
  heroCoord?: ComputedRef<IHexCoordinates | null>,
) {
  const probeRef = ref<HTMLElement | null>(null);
  const containerRef = ref<HTMLElement | null>(null);
  const domTileW = ref(0);
  const domTileH = ref(0);
  const containerWidth = ref(0);
  const containerHeight = ref(0);

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

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

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const points = [...tiles.value.map((t) => t.coordinates), ...(extraPoints?.value ?? [])];

    for (const coordinates of points) {
      const { x, y } = calcHexPixelPosition({ coordinates }, w, h);
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

  const cameraTarget = computed(() => {
    const b = mapBounds.value;
    const w = domTileW.value || 0;
    const h = domTileH.value || 0;
    const cw = containerWidth.value;
    const ch = containerHeight.value;
    if (!b.width || !b.height || !cw || !ch) return null;

    let focusX = b.width / 2;
    let focusY = b.height / 2;

    const coord = heroCoord?.value;
    if (coord && w && h) {
      const { x, y } = calcHexPixelPosition({ coordinates: coord }, w, h);
      focusX = x + w / 2 - b.offsetX;
      focusY = y + h / 2 - b.offsetY;
    }

    return {
      x: cw / 2 - focusX * scale.value,
      y: ch / 2 - focusY * scale.value,
    };
  });

  const cameraRender = ref({ x: 0, y: 0 });
  const cameraOffset = computed(() => ({
    x: cameraRender.value.x,
    y: cameraRender.value.y,
  }));

  let started = false;
  let rafId: number | null = null;
  let lastFrame = 0;

  function snapCamera() {
    const target = cameraTarget.value;
    if (!target) return;
    cameraRender.value = { x: target.x, y: target.y };
    started = true;
  }

  function tick(now: number) {
    rafId = null;
    const target = cameraTarget.value;
    if (!target) return;

    if (!started || reduceMotion) {
      cameraRender.value = { x: target.x, y: target.y };
      started = true;
      return;
    }

    const dt = lastFrame ? Math.min(64, now - lastFrame) : 16;
    lastFrame = now;
    const k = 1 - Math.exp(-dt / SMOOTH_TAU_MS);
    const cur = cameraRender.value;
    const nx = cur.x + (target.x - cur.x) * k;
    const ny = cur.y + (target.y - cur.y) * k;

    if (Math.abs(target.x - nx) < SETTLE_PX && Math.abs(target.y - ny) < SETTLE_PX) {
      cameraRender.value = { x: target.x, y: target.y };
      return;
    }

    cameraRender.value = { x: nx, y: ny };
    rafId = requestAnimationFrame(tick);
  }

  function wake() {
    if (rafId != null) return;
    lastFrame = 0;
    rafId = requestAnimationFrame(tick);
  }

  watch(cameraTarget, wake, { deep: true });

  let probeResizeObserver: ResizeObserver | null = null;
  let containerResizeObserver: ResizeObserver | null = null;
  let sizeFallbackTimer: number | null = null;

  onMounted(() => {
    if (probeRef.value) {
      probeResizeObserver = new ResizeObserver(() => readDomTileSize());
      probeResizeObserver.observe(probeRef.value);
    }

    if (containerRef.value) {
      containerResizeObserver = new ResizeObserver(() => readContainerSize());
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
    }, 100);

    wake();
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
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  });

  return {
    probeRef,
    containerRef,
    domTileW,
    domTileH,
    domTileSize,
    mapBounds,
    scale,
    cameraOffset,
    snapCamera,
  };
}
