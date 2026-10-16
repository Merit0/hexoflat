<template>
  <Teleport to="body">
    <div
      v-if="view"
      ref="layer"
      class="tip-layer"
      :style="{ left: `${position.left}px`, top: `${position.top}px` }"
    >
      <item-tooltip :view="view" />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import ItemTooltip from './item-tooltip.vue';
import { computeTooltipPosition, useItemTooltip } from '@/composables/use-item-tooltip';

const { target, view } = useItemTooltip();
const layer = ref<HTMLElement | null>(null);
const position = ref({ left: 0, top: 0 });

watch(
  view,
  async (next) => {
    if (!next || !target.value) return;
    await nextTick();
    const element = layer.value;
    if (!element || !target.value) return;
    position.value = computeTooltipPosition(
      target.value.rect,
      { width: element.offsetWidth, height: element.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
    );
  },
  { flush: 'post' },
);
</script>

<style scoped>
.tip-layer {
  position: fixed;
  z-index: 10000;
  pointer-events: none;
}
</style>
