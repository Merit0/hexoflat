import { onBeforeUnmount, onMounted, ref } from 'vue';

/**
 * Shrinks (never grows) a content box to fit inside its wrapper's box — both
 * width and height — via a CSS transform, driven by ResizeObserver on both
 * boxes. Used to fit components that size themselves for a spacious layout
 * (hero-equip-board.vue's fixed hex flower, inventory-board-grid.vue's fixed
 * cell grid) into the narrower/shorter hero-board panel without touching
 * their own sizing logic — mirrors the scale-to-fit approach
 * use-hex-board-sizing.ts already uses for the map itself.
 */
export function useFitToWidth() {
  const wrapperRef = ref<HTMLElement | null>(null);
  const contentRef = ref<HTMLElement | null>(null);
  const scale = ref(1);
  // The content's overflowing children (e.g. inventory-board-grid.vue's
  // grid, which auto-sizes its track to its own oversized content) render
  // flush against the content box's top-left corner, not centered around
  // it — so scaling from `transform-origin: top left` and re-centering the
  // scaled footprint with this pixel offset is what actually centers it,
  // instead of `scale` alone leaving it lopsided against one edge.
  const offsetX = ref(0);
  const offsetY = ref(0);
  // The content's natural (unscaled) footprint — exposed so a caller can
  // size a sibling overlay (e.g. a "centered on top of this" layer) to the
  // same box the scaling math is actually using, instead of guessing.
  const contentWidth = ref(0);
  const contentHeight = ref(0);

  function updateScale() {
    const wrapper = wrapperRef.value;
    const content = contentRef.value;
    if (!wrapper || !content) return;

    const wrapperBox = wrapper.getBoundingClientRect();
    const nextContentWidth = content.scrollWidth;
    const nextContentHeight = content.scrollHeight;
    if (!wrapperBox.width || !wrapperBox.height || !nextContentWidth || !nextContentHeight) return;

    contentWidth.value = nextContentWidth;
    contentHeight.value = nextContentHeight;

    const nextScale = Math.min(
      1,
      wrapperBox.width / nextContentWidth,
      wrapperBox.height / nextContentHeight,
    );
    scale.value = nextScale;
    offsetX.value = Math.max(0, (wrapperBox.width - nextContentWidth * nextScale) / 2);
    offsetY.value = Math.max(0, (wrapperBox.height - nextContentHeight * nextScale) / 2);
  }

  let wrapperObserver: ResizeObserver | null = null;
  let contentObserver: ResizeObserver | null = null;

  onMounted(() => {
    if (wrapperRef.value) {
      wrapperObserver = new ResizeObserver(updateScale);
      wrapperObserver.observe(wrapperRef.value);
    }
    if (contentRef.value) {
      contentObserver = new ResizeObserver(updateScale);
      contentObserver.observe(contentRef.value);
    }
    updateScale();
  });

  onBeforeUnmount(() => {
    wrapperObserver?.disconnect();
    wrapperObserver = null;
    contentObserver?.disconnect();
    contentObserver = null;
  });

  return { wrapperRef, contentRef, scale, offsetX, offsetY, contentWidth, contentHeight };
}
