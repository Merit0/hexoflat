<template>
  <div
      class="hero-hex-tile"
      role="button"
      tabindex="0"
      aria-label="Open hero inventory"
      :style="style"
      @click="openInventory"
      @keydown.enter="openInventory"
      @keydown.space.prevent="openInventory"
  ></div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { IHexCoordinates } from "@/a-game-scenes/map-scene/interfaces/hex-tile-config-interface";
import { calcHexPixelPosition } from "@/utils/hex-utils";
import {useOverlayStore} from "@/stores/overlay-store";

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

const openInventory = () => {
  const overlayStore = useOverlayStore();
  overlayStore.openOverlay("hero-inventory");
}
</script>

<style scoped>
.hero-hex-tile {
  position: absolute;
  width: var(--hex-tile-width);
  height: var(--hex-tile-height);
  background-image: url("/hero-asssets/spirit-hex-image.png");
  background-size: cover;
  background-repeat: no-repeat;
  background-position: center;
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
}

.hero-hex-tile:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(150, 200, 255, 0.85);
}
</style>