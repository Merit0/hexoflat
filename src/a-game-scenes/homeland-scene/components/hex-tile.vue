<template>
  <div
      class="hex-tile game-root"
      :class="tileClasses"
      :style="getHexTileTransformStyle(hexTile)"
      @click="emit('tile-click', hexTile)"
      @pointerenter="onEnter"
  >
    <div
        :style="getHexTileImage(hexTile)"
    ></div>
    <div v-if="isAllowedTarget" class="tool-target-glow"></div>
  </div>
</template>

<script setup lang="ts">
import type { IHexTile } from "@/a-game-scenes/homeland-scene/models/hex-tile-model";
import { calcHexPixelPosition } from "@/utils/tile-utils";
import {computed} from "vue";
import { coordinateKey } from "@/utils/hex-utils";
import { useHeroToolStore } from "@/stores/hero-tool-store";

const props = defineProps<{
  hexTile: IHexTile;
}>();

const emit = defineEmits<{
  (e: "tile-click", tile: IHexTile): void;
}>();

const heroToolStore = useHeroToolStore();
const GRID_COLUMNS = 42;
const tileWidth = window.innerWidth / GRID_COLUMNS;
const tileKey = computed(() => coordinateKey(props.hexTile.coordinates));

function getHexTileTransformStyle(tile: IHexTile) {
  const { x, y } = calcHexPixelPosition(tile, tileWidth);

  return {
    "--tx": `${x}px`,
    "--ty": `${y}px`,
  } as Record<string, string>;
}

const isAllowedTarget = computed(() => {
  return heroToolStore.isDragging && heroToolStore.allowedKeySet.has(tileKey.value);
});

const tileClasses = computed(() => ({
  "is-tool-target": isAllowedTarget.value,
  "tool-hand": heroToolStore.isDragging && heroToolStore.activeTool === "hand",
  "tool-axe": heroToolStore.isDragging && heroToolStore.activeTool === "axe",
}));

function onEnter() {
  if (!heroToolStore.isDragging) return;
  heroToolStore.updateHover(props.hexTile.coordinates);
}

function getHexTileImage(tile: IHexTile) {
  const img = tile.isRevealed
      ? tile.imagePath
      : "src/a-game-scenes/homeland-scene/assets/hex-tile-terrain-images/fog-tile-image.png";

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
  --hex-scale: 1.05;
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

.tool-target-glow {
  position: absolute;
  inset: 6px;
  pointer-events: none;

  clip-path: polygon(
      25% 0%,
      75% 0%,
      100% 50%,
      75% 100%,
      25% 100%,
      0% 50%
  );

  animation: glowPulse 1.25s ease-in-out infinite;
}

@keyframes glowPulse {
  0%, 100% { opacity: 0.28; transform: scale(0.985); }
  50% { opacity: 0.44; transform: scale(1.02); }
}

/* 🟡 підсвітка для HAND */
.hex-tile.is-tool-target.tool-hand .tool-target-glow {
  background: rgba(230, 193, 90, 0.18);
  box-shadow:
      0 0 0 1px rgba(230, 193, 90, 0.28),
      0 10px 28px rgba(230, 193, 90, 0.18);
}

/* 🔵 підсвітка для AXE */
.hex-tile.is-tool-target.tool-axe .tool-target-glow {
  background: rgba(90, 163, 230, 0.18);
  box-shadow:
      0 0 0 1px rgba(90, 163, 230, 0.28),
      0 10px 28px rgba(90, 163, 230, 0.18);
}

</style>