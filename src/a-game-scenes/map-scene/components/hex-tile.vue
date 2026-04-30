<template>
  <div
      class="hex-tile game-root"
      :style="getHexTileTransformStyle(hexTile)"
      @click="emit('tile-click', hexTile)"
      @pointerenter="onEnter"
  >
    <div class="hex-layer hex-tile-bg" :style="getHexTileBackgroundStyle(hexTile)"></div>
    <div class="hex-layer hexobject-sprite" :style="getHexTileImage(hexTile)"></div>
    <div v-if="constructionLockLabel" class="hex-tile-lock-chip">
      {{ constructionLockLabel }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { IHexTile } from "@/a-game-scenes/map-scene/models/hex-tile-model";
import { useHeroToolStore } from "@/stores/hero-tool-store";
import {calcHexPixelPosition} from "@/utils/hex-utils";
import { EHexobjectGroup } from "@/abstraction/hexobject-abstraction";
import { useWorldMapStore } from "@/stores/world-map-store";
import { HEXOBJECT_META } from "@/registry/hexobject-meta";

const props = defineProps<{
  hexTile: IHexTile;
  nowTick?: number;
}>();

const emit = defineEmits<{
  (e: "tile-click", tile: IHexTile): void;
  (e: "tile-hover", tile: IHexTile): void;
}>();

const EMPTY_TILE_URL = "/hex-assets/hex-tiles/empty-tile-image.png";
const heroToolStore = useHeroToolStore();
const worldStore = useWorldMapStore();
const GRID_COLUMNS = 42;
const tileWidth = window.innerWidth / GRID_COLUMNS;

const constructionLockLabel = computed(() => {
  void props.nowTick;

  const tile = props.hexTile;
  const hexobject = tile.hexobject;
  if (!tile.isRevealed || !hexobject) return null;
  if (hexobject.groupType !== EHexobjectGroup.CONSTRUCTION) return null;

  const enterCfg = HEXOBJECT_META[hexobject.hexobjectKey]?.enter;
  if (enterCfg?.type === "WORLD") {
    const remainingMs = worldStore.getLocationRespawnRemainingMs(enterCfg.locationKey);
    if (remainingMs > 0) {
      const totalSeconds = Math.ceil(remainingMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
  }

  if (!hexobject.isInteractable && hexobject.construction.isLocked) {
    return "locked";
  }

  return null;
});

function getHexTileTransformStyle(tile: IHexTile) {
  const { x, y } = calcHexPixelPosition(tile, tileWidth);

  return {
    "--tx": `${x}px`,
    "--ty": `${y}px`,
  } as Record<string, string>;
}

function onEnter() {
  emit("tile-hover", props.hexTile);
  if (!heroToolStore.isDragging) return;
  heroToolStore.updateHover(props.hexTile.coordinates);
}

function getHexTileImage(tile: IHexTile) {
  const img = tile.isRevealed
      ? (tile.hexobject?.spritePath || EMPTY_TILE_URL)
      : EMPTY_TILE_URL;

  return {
    backgroundImage: `url("${img}")`,
    backgroundSize: "cover",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center",
  };
}

function getHexTileBackgroundStyle(tile: IHexTile) {
  const img = tile.isRevealed
      ? (tile.hexBackgroundImagePath || "/hex-assets/token-placement-image.png")
      : "/hex-assets/hex-effects/fog-tile-image.png";

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
  top: -2%;

  transform: scale(1);
  transition: transform 120ms ease-out, filter 120ms ease-out;

  image-rendering: crisp-edges;
  will-change: transform;
}

.hex-tile:hover .hexobject-sprite {
  transform: scale(1.05);
  filter: contrast(1.02);
}

.hex-tile-lock-chip {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 3;
  transform: translate(-50%, -50%);
  min-width: 38px;
  padding: 5px 9px;
  border-radius: 999px;
  background: rgba(22, 26, 34, 0.84);
  border: 1px solid rgba(205, 214, 228, 0.22);
  color: rgba(242, 233, 211, 0.96);
  font-family: var(--font-main), serif;
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0.08em;
  white-space: nowrap;
  text-transform: uppercase;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.24);
  pointer-events: none;
}

</style>
