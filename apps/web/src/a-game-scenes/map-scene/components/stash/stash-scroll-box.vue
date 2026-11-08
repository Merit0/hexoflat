<template>
  <div class="scroll-box">
    <div
      ref="scroller"
      class="scroller"
      :class="{ 'fade-top': canScrollUp, 'fade-bottom': canScrollDown }"
      @scroll.passive="measure"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

const EDGE_PX = 2;

const scroller = ref<HTMLElement | null>(null);
const canScrollUp = ref(false);
const canScrollDown = ref(false);
let observer: ResizeObserver | null = null;

function measure() {
  const el = scroller.value;
  if (!el) return;
  canScrollUp.value = el.scrollTop > EDGE_PX;
  canScrollDown.value = el.scrollTop + el.clientHeight < el.scrollHeight - EDGE_PX;
}

onMounted(() => {
  measure();
  if (!scroller.value) return;
  observer = new ResizeObserver(measure);
  observer.observe(scroller.value);
  if (scroller.value.firstElementChild) observer.observe(scroller.value.firstElementChild);
});

onBeforeUnmount(() => observer?.disconnect());

defineExpose({ scroller });
</script>

<style scoped>
.scroll-box {
  position: relative;
  flex: 1;
  min-height: 0;
}
.scroller {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: rgba(122, 141, 160, 0.5) transparent;
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
.scroller.fade-top {
  --fade-top: 22px;
}
.scroller.fade-bottom {
  --fade-bottom: 22px;
}
</style>
