<template>
  <div class="hex-board-overlays" :style="style">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { BoardCamera, WorldRect } from '@/render/board-camera';
import { boardOverlayStyle } from '@/render/board-overlay-style';

const props = defineProps<{ camera: BoardCamera; frameRect: WorldRect | null }>();

const style = computed(() => boardOverlayStyle(props.camera, props.frameRect));
</script>

<style scoped>
.hex-board-overlays {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}
</style>
