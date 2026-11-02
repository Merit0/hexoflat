<template>
  <div class="tool-hex-pos" :style="posStyle">
    <slot :flipped="flipped" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { calcHexPixelPosition } from '@hexoflat/engine/utils/hex-utils';

const props = defineProps<{
  at: IHexCoordinates | null;
  origin: IHexCoordinates | null;
  tileWidth: number;
  tileHeight: number;
}>();

const pixelOf = (coordinates: IHexCoordinates) =>
  calcHexPixelPosition({ coordinates }, props.tileWidth, props.tileHeight);

const posStyle = computed(() => {
  if (!props.at) return { display: 'none' };
  const { x, y } = pixelOf(props.at);
  return { transform: `translate(${Math.round(x)}px, ${Math.round(y)}px)` };
});

const flipped = computed(() => {
  if (!props.at || !props.origin) return false;
  return pixelOf(props.at).x < pixelOf(props.origin).x;
});
</script>

<style scoped>
.tool-hex-pos {
  position: absolute;
  z-index: 120;
  width: var(--hex-tile-width);
  height: var(--hex-tile-height);
  pointer-events: auto;

  transition: transform 120ms linear;
  will-change: transform;
  transform: translateZ(0);
}
</style>
