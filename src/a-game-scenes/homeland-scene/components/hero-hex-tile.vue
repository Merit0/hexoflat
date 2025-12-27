<template>
  <div class="hero-hex-tile" :style="style"></div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { IHexCoordinates } from "@/a-game-scenes/homeland-scene/interfaces/hex-tile-config-interface";
import { calcHexPixelPosition } from "@/utils/tile-utils";

const props = defineProps<{
  coord: IHexCoordinates | null;
  tileWidth: number;
}>();

const style = computed(() => {
  if (!props.coord) {
    return { display: "none" } as Record<string, string>;
  }
  const pseudoTile = { coordinates: props.coord } as any;
  const { x, y } = calcHexPixelPosition(pseudoTile, props.tileWidth);

  return {
    transform: `translate(${x}px, ${y}px)`,
  } as Record<string, string>;
});
</script>

<style scoped>
.hero-hex-tile {
  position: absolute;
  width: var(--hex-tile-width);
  height: var(--hex-tile-height);
  background: #ffffff;
  clip-path: polygon(
      25% 0%,
      75% 0%,
      100% 50%,
      75% 100%,
      25% 100%,
      0% 50%
  );

  /* smooth hero move between tiles */
  transition: transform 180ms ease-out;

  z-index: 100;
  pointer-events: none;
}
</style>