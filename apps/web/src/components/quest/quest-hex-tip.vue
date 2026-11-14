<template>
  <div class="tip" data-testid="quest-hex-tip" :style="style">{{ tip.label }}</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { TileAnchor } from '@/render/layers/tiles-layer';

const props = defineProps<{ tip: { label: string; anchor: TileAnchor } }>();
const style = computed(() => ({
  left: `${props.tip.anchor.centerX}px`,
  top: `${props.tip.anchor.top - 8}px`,
}));
</script>

<style scoped>
.tip {
  position: fixed;
  z-index: 400;
  transform: translate(-50%, -100%);
  padding: 4px 10px;
  border: 1px solid #c9a24a;
  border-radius: 4px;
  background: #1b1714;
  color: #f1e4cc;
  font-size: 0.85rem;
  pointer-events: none;
  white-space: nowrap;
}
</style>
