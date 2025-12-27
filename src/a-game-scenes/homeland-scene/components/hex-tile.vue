<template>
  <div
      class="hex-tile game-root"
      :style="getHexTileTransformStyle(hexTile)"
      @click="emit('tile-click', hexTile)"
  >
    <div
        :class="`hex-tile-img-${hexTile.tileType}`"
        :style="getHexTileImage(hexTile)"
    ></div>
  </div>
</template>

<script setup lang="ts">
import type { IHexTile } from "@/a-game-scenes/homeland-scene/models/hex-tile-model";
import { calcHexPixelPosition } from "@/utils/tile-utils";

const props = defineProps<{
  hexTile: IHexTile;
}>();

const emit = defineEmits<{
  (e: "tile-click", tile: IHexTile): void;
}>();

const GRID_COLUMNS = 42;
const tileWidth = window.innerWidth / GRID_COLUMNS;

function getHexTileTransformStyle(tile: IHexTile) {
  const { x, y } = calcHexPixelPosition(tile, tileWidth);

  return {
    "--tx": `${x}px`,
    "--ty": `${y}px`,
  } as Record<string, string>;
}

function getHexTileImage(tile: IHexTile) {
  const img = tile.isRevealed
      ? tile.imagePath
      : "src/a-game-scenes/homeland-scene/assets/hex-tile-terrain-images/fog-tile-image-2.png";

  return {
    backgroundImage: `url(${img})`,
    backgroundSize: "cover",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center",
  };
}
</script>

<style scoped>
@import "@/a-game-scenes/homeland-scene/styles/hex-tile-terrain-background-style.css";

.hex-tile {
  /* дефолти для css-vars позиції */
  --tx: 0px;
  --ty: 0px;

  width: var(--hex-tile-width);
  height: var(--hex-tile-height);
  position: absolute;

  clip-path: polygon(
      25% 0%,
      75% 0%,
      100% 50%,
      75% 100%,
      25% 100%,
      0% 50%
  );

  display: flex;
  align-items: center;
  justify-content: center;

  cursor: pointer;
  transform-origin: center center;
  will-change: transform;

  transform: translate(var(--tx), var(--ty)) scale(var(--hex-scale, 1));

  transition: transform 0.16s ease, filter 0.16s ease;
}

.hex-tile:hover {
  --hex-scale: 1.1;
  filter: brightness(1.15);
  z-index: 50;
}

.hex-tile > div {
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  pointer-events: none;
}
</style>