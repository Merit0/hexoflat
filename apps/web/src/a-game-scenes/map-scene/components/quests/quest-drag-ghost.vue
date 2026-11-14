<template>
  <Teleport to="body">
    <div
      v-if="questDrag.active"
      ref="host"
      class="ghost"
      :style="{
        left: `${questDrag.x - questDrag.grabX}px`,
        top: `${questDrag.y - questDrag.grabY}px`,
        width: `${questDrag.width}px`,
        height: `${questDrag.height}px`,
      }"
      data-testid="quest-drag-ghost"
      aria-hidden="true"
    ></div>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { questDrag, questDragNode } from '@/composables/use-quest-drag';

const host = ref<HTMLElement | null>(null);

watch(
  () => questDragNode.value,
  async (node) => {
    await nextTick();
    if (host.value && node) host.value.replaceChildren(node);
  },
);
</script>

<style scoped>
.ghost {
  position: fixed;
  z-index: 10001;
  pointer-events: none;
  opacity: 0.92;
  filter: drop-shadow(0 0 10px rgba(245, 194, 107, 0.45))
    drop-shadow(0 10px 16px rgba(0, 0, 0, 0.6));
  transform: rotate(-1.5deg);
}
</style>
