<template>
  <div
      class="hex-tile game-root"
      :class="tileClasses"
      :style="getHexTileTransformStyle(hexTile)"
      @click="emit('tile-click', hexTile)"
      @pointerenter="onEnter"
  >
    <div class="hex-layer hex-tile-bg" :style="getHexTileBackgroundStyle(hexTile)"></div>
    <div class="hex-layer hexobject-sprite" :style="getHexTileImage(hexTile)">
      <div v-if="!hexTile.hexobject && hexTile.isRevealed" class="coordinates-class">
        q{{ hexTile.coordinates.columnIndex }} · r{{ hexTile.coordinates.rowIndex }}
      </div>
    </div>
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
      ? tile?.hexobject?.spritePath
      : "src/a-game-scenes/homeland-scene/assets/hex-tile-terrain-images/fog-tile-image.png";

  return {
    backgroundImage: `url(${img})`,
    backgroundSize: "cover",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center",
  };
}

function getHexTileBackgroundStyle(tile: IHexTile) {
  const img = tile.isRevealed
      ? (tile.hexBackgroundImagePath || "src/a-game-scenes/homeland-scene/assets/hex-tile-terrain-images/empty-tile-image.png")
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

.hex-tile.is-tool-target.tool-hand .tool-target-glow {
  background: rgba(230, 193, 90, 0.18);
  box-shadow:
      0 0 0 1px rgba(230, 193, 90, 0.28),
      0 10px 28px rgba(230, 193, 90, 0.18);
}

.hex-tile.is-tool-target.tool-axe .tool-target-glow {
  background: rgba(203, 48, 48, 0.18);
  box-shadow:
      0 0 0 1px rgba(90, 163, 230, 0.28),
      0 10px 28px rgba(90, 163, 230, 0.18);
}

.coordinates-class {
  position: absolute;
  left: 50%;
  bottom: 40%;
  transform: translateX(-50%);
  font-size: 0.5rem;
  line-height: 1;
  letter-spacing: 0.4px;
  font-variant-numeric: tabular-nums;
  color: rgba(253, 255, 230, 0.82);
  box-shadow:
      0 6px 18px rgba(0, 0, 0, 0.45),
      0 0 10px rgba(140, 185, 255, 0.08);

  pointer-events: none;

  max-width: 90%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.85;
}

.hex-layer {
  position: absolute;
  inset: 0;
}

.hex-tile-bg {
  z-index: 1;
  scale: 1.03;
}

.hexobject-sprite {
  z-index: 2;
  pointer-events: none;
}

</style>