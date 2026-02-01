<template>
  <div
      class="hex-tile game-root"
      :class="tileClasses"
      :style="getHexTileTransformStyle(hexTile)"
      @click="emit('tile-click', hexTile)"
      @pointerenter="onEnter"
  >
    <div class="hex-layer hex-tile-bg" :style="getHexTileBackgroundStyle(hexTile)"></div>
    <div class="hex-layer hexobject-sprite" :style="getHexTileImage(hexTile)"></div>
    <div v-if="isAllowedTarget" class="tool-target-glow"></div>
  </div>
</template>

<script setup lang="ts">
import type { IHexTile } from "@/a-game-scenes/map-scene/models/hex-tile-model";
import {computed} from "vue";
import { coordinateKey, calcHexPixelPosition} from "@/utils/hex-utils";
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
      : "src/a-game-scenes/map-scene/assets/hex-tile-terrain-images/empty-tile-image.png";

  return {
    backgroundImage: `url(${img})`,
    backgroundSize: "cover",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center",
  };
}

function getHexTileBackgroundStyle(tile: IHexTile) {
  const img = tile.isRevealed
      ? (tile.hexBackgroundImagePath || "src/a-game-scenes/map-scene/assets/hex-tile-terrain-images/empty-tile-image.png")
      : "src/assets/hex-assets/hex-effects/fog-tile-image.png";

  return {
    backgroundImage: `url(${img})`,
    backgroundSize: "cover",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center",
  };
}
</script>

<style scoped>

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
  transform: translate(var(--tx), var(--ty));
}

.hex-tile::before {
  content: "";
  position: absolute;
  inset: 0;
  clip-path: inherit;
  pointer-events: none;

  /* “скло” — холодний напівпрозорий шар */
  background: linear-gradient(
      145deg,
      rgba(220, 235, 255, 0.18),
      rgba(140, 170, 210, 0.10)
  );

  opacity: 0.45;
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
  color: rgb(248, 255, 155);
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
  transition: filter 0.16s ease, transform 0.16s ease;
  will-change: filter, transform;
  transform: translateZ(0);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  filter:
      contrast(1.1)
      saturate(0.95)
      brightness(1);
}

.hexobject-sprite {
  z-index: 2;
  pointer-events: none;

  transform: scale(1);
  transition: transform 120ms ease-out, filter 120ms ease-out;

  image-rendering: crisp-edges;
  will-change: transform;
}

.hex-tile:hover .hexobject-sprite {
  transform: scale(1.1);
  filter: contrast(1.02);
}

</style>