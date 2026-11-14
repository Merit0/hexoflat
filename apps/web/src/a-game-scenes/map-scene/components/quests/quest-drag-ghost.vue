<template>
  <Teleport to="body">
    <div
      v-if="questDrag.active"
      class="ghost"
      :style="{ left: `${questDrag.x}px`, top: `${questDrag.y}px` }"
      data-testid="quest-drag-ghost"
    >
      {{ questDrag.label }}
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { questDrag } from '@/composables/use-quest-drag';
</script>

<style scoped>
.ghost {
  position: fixed;
  z-index: 10001;
  max-width: 220px;
  padding: 8px 14px;
  overflow: hidden;
  font-weight: 700;
  color: #ffe98a;
  text-overflow: ellipsis;
  white-space: nowrap;
  pointer-events: none;
  background: linear-gradient(180deg, #2a2418, #17140c);
  border: 1px solid #d9a84e;
  border-radius: 10px;
  box-shadow:
    0 0 12px rgba(245, 194, 107, 0.5),
    0 8px 18px rgba(0, 0, 0, 0.6);
  transform: translate(-50%, -50%) rotate(-2deg);
}
</style>
