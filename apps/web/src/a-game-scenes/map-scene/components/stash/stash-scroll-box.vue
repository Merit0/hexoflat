<template>
  <div class="scroll-box">
    <div
      ref="scroller"
      class="scroller"
      data-scroller
      :class="{ 'fade-top': canScrollUp, 'fade-bottom': canScrollDown }"
      @scroll.passive="measure"
    >
      <slot />
    </div>
    <button
      v-if="moreSelector && hiddenBelow > 0 && !stashDrag.active"
      type="button"
      class="more"
      :data-testid="moreTestid"
      @click="scrollDown"
    >
      {{ stashMoreText(hiddenBelow) }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, onUpdated, ref } from 'vue';
import { stashDrag } from '@/composables/stash-drag-state';
import { stashMoreText } from '@/composables/stash-messages';

const EDGE_PX = 2;
const PAGE_RATIO = 0.8;

const props = defineProps<{ moreSelector?: string; moreTestid?: string }>();

const scroller = ref<HTMLElement | null>(null);
const canScrollUp = ref(false);
const canScrollDown = ref(false);
const hiddenBelow = ref(0);
let observer: ResizeObserver | null = null;

function measure() {
  const el = scroller.value;
  if (!el) return;
  canScrollUp.value = el.scrollTop > EDGE_PX;
  const bottom = el.scrollTop + el.clientHeight;
  canScrollDown.value = bottom < el.scrollHeight - EDGE_PX;
  hiddenBelow.value =
    props.moreSelector && el.clientHeight > 0
      ? [...el.querySelectorAll<HTMLElement>(props.moreSelector)].filter(
          (node) => node.offsetTop >= bottom,
        ).length
      : 0;
}

function scrollDown() {
  const el = scroller.value;
  if (!el) return;
  const top = Math.round(el.clientHeight * PAGE_RATIO);
  if (typeof el.scrollBy === 'function') el.scrollBy({ top, behavior: 'smooth' });
  else el.scrollTop += top;
}

onUpdated(measure);

onMounted(() => {
  measure();
  if (!scroller.value) return;
  observer = new ResizeObserver(measure);
  observer.observe(scroller.value);
  if (scroller.value.firstElementChild) observer.observe(scroller.value.firstElementChild);
});

onBeforeUnmount(() => observer?.disconnect());
</script>

<style scoped>
.scroll-box {
  position: relative;
  flex: 1;
  min-height: 0;
  margin-right: calc(-1 * var(--stash-pad, 0px));
}
.more {
  position: absolute;
  left: 50%;
  bottom: 6px;
  transform: translateX(-50%);
  z-index: 2;
  min-height: 0;
  height: auto;
  padding: 3px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 220, 150, 0.55);
  background: linear-gradient(180deg, rgba(43, 46, 52, 0.95), rgba(18, 12, 8, 0.96));
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.45);
  color: rgba(255, 236, 186, 0.95);
  font-size: 0.72rem;
  font-weight: 800;
  white-space: nowrap;
}
.scroller {
  position: absolute;
  inset: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  --fade-top: 0px;
  --fade-bottom: 0px;
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0,
    #000 var(--fade-top),
    #000 calc(100% - var(--fade-bottom)),
    transparent 100%
  );
  mask-image: linear-gradient(
    to bottom,
    transparent 0,
    #000 var(--fade-top),
    #000 calc(100% - var(--fade-bottom)),
    transparent 100%
  );
}
.scroller::-webkit-scrollbar {
  width: 6px;
}
.scroller::-webkit-scrollbar-thumb {
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.3);
}
.scroller::-webkit-scrollbar-track {
  background: transparent;
}
@supports not selector(::-webkit-scrollbar) {
  .scroller {
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
  }
}
.scroller.fade-top {
  --fade-top: 22px;
}
.scroller.fade-bottom {
  --fade-bottom: 22px;
}
</style>
