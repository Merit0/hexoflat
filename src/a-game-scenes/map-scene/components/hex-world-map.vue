<template>
  <div class="hex-map game-root">
    <div class="hex-map-wrapper" :style="{ transform: `scale(${scale})` }">
      <div ref="probeRef" class="hex-probe" aria-hidden="true"></div>

      <div
          class="hex-map-inner"
          :style="{
          width: mapBounds.width + 'px',
          height: mapBounds.height + 'px',
          transform: `translate(${Math.round(-mapBounds.offsetX)}px, ${Math.round(-mapBounds.offsetY)}px)`,
        }"
      >
        <hero-hex-tile :coord="store.heroCoordinates" :tileWidth="tileWidth" />

        <tool-hex-tile
            v-if="heroToolStore.isDragging && activeTool"
            :coord="heroToolStore.hover"
            :tileWidth="tileWidth"
            :tool="activeTool"
            :actionHint="heroToolStore.hintLabel || undefined"
            @hide="onHide"
        />

        <hex-tile
            v-for="tile in tiles"
            :key="tile.tileId"
            :hex-tile="tile"
            @tile-click="handleTileClick"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { HexTileModel } from "@/a-game-scenes/map-scene/models/hex-tile-model";
import { useWorldMapStore } from "@/stores/world-map-store";
import HexTile from "@/a-game-scenes/map-scene/components/hex-tile.vue";
import HeroHexTile from "@/a-game-scenes/map-scene/components/hero-hex-tile.vue";
import ToolHexTile from "@/a-game-scenes/map-scene/components/tool-hex-tile.vue";
import { calcHexPixelPosition } from "@/utils/tile-utils";
import { useTileClick } from "@/composables/use-tile-click";
import { useHeroToolStore } from "@/stores/hero-tool-store";
import { resolveActions } from "@/game-resolvers/interactions-resolver";

const { handleTileClick } = useTileClick();
const store = useWorldMapStore();
const heroToolStore = useHeroToolStore();
const worldMapStore = useWorldMapStore();

store.loadFromStorage();
store.generateIfEmpty();

const tiles = computed<HexTileModel[]>(() => store.map?.tiles ?? []);
const activeTool = computed(() => heroToolStore.activeTool);

const GRID_COLUMNS = 42;

/**
 * ✅ IMPORTANT: keep your existing coordinate contract.
 * This must match calcHexPixelPosition usage across tiles/hero/tool.
 */
const tileWidth = window.innerWidth / GRID_COLUMNS;

/**
 * Probe -> REAL DOM tile size (px)
 */
const probeRef = ref<HTMLElement | null>(null);
const domTileW = ref(0);
const domTileH = ref(0);

function readDomTileSize() {
  const el = probeRef.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (r.width > 0) domTileW.value = r.width;
  if (r.height > 0) domTileH.value = r.height;
}

/* tool resolver (unchanged) */
function getTileByCoord(coord: any) {
  return worldMapStore.map.tiles.find((t: any) =>
      t.coordinates.rowIndex === coord.rowIndex &&
      t.coordinates.columnIndex === coord.columnIndex
  );
}

watch(
    () => [heroToolStore.isDragging, heroToolStore.activeTool, heroToolStore.hover] as const,
    ([isDragging, tool, hover]) => {
      if (!isDragging || !tool || !hover) {
        heroToolStore.clearResolvedActions();
        return;
      }

      const tile = getTileByCoord(hover);
      if (!tile?.hexobject || !tile.hexobject.isInteractable) {
        heroToolStore.clearResolvedActions();
        return;
      }

      const actions = resolveActions(tool, tile.hexobject);
      heroToolStore.setResolvedActions(actions);
    },
    { immediate: true }
);

/**
 * ✅ Bounds based on:
 * - your math positions {x,y}
 * - real DOM size {domTileW, domTileH}
 */
const bleed = 2;

const mapBounds = computed(() => {
  const w = domTileW.value || 0;
  const h = domTileH.value || 0;

  if (!w || !h) {
    return { width: 0, height: 0, offsetX: 0, offsetY: 0 };
  }

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const t of tiles.value) {
    const { x, y } = calcHexPixelPosition(t, tileWidth);

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }

  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    return { width: 0, height: 0, offsetX: 0, offsetY: 0 };
  }

  return {
    width: (maxX - minX) + bleed * 2,
    height: (maxY - minY) + bleed * 2,
    offsetX: minX - bleed,
    offsetY: minY - bleed,
  };
});

const scale = ref(1);

function updateScale() {
  const b = mapBounds.value;
  if (!b.width || !b.height) return;

  const padding = 40;
  const sx = (window.innerWidth - padding) / b.width;
  const sy = (window.innerHeight - padding) / b.height;

  scale.value = Math.min(sx, sy, 1.1);
}

function onKey(e: KeyboardEvent) {
  if (e.key !== "Escape") return;
  if (heroToolStore.isLocked) {
    heroToolStore.cancelLockedAction("ESC");
    worldMapStore.saveToStorage();
  }
  heroToolStore.stopTool();
  worldMapStore.saveToStorage();
}

function onHide() {
  if (heroToolStore.isLocked) {
    heroToolStore.cancelLockedAction("HIDE");
    worldMapStore.saveToStorage();
  }
  heroToolStore.stopTool();
}

function onResize() {
  readDomTileSize();
  updateScale();
}

watch(mapBounds, updateScale, { immediate: true });

onMounted(() => {
  requestAnimationFrame(() => {
    readDomTileSize();
    updateScale();
  });

  window.addEventListener("resize", onResize);
  window.addEventListener("keydown", onKey);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", onResize);
  window.removeEventListener("keydown", onKey);
});
</script>

<style scoped>
@import "@/a-game-scenes/map-scene/styles/hex-tile-terrain-background-style.css";

.hex-map {
  display: grid;
  place-items: center;
  width: 100vw;
  height: 100vh;
  background-image: url("@/a-game-scenes/map-scene/assets/dark-board-stones.png");
  background-size: 100% 100%;
  background-position: center;
  background-repeat: no-repeat;
  overflow: hidden;
}

.hex-map-wrapper {
  width: max-content;
  height: max-content;
  transform-origin: center center;
  position: relative;
}

/* Probe uses the same tokens as real tiles */
.hex-probe {
  position: absolute;
  width: var(--hex-tile-width);
  height: var(--hex-tile-height);
  visibility: hidden;
  pointer-events: none;
}

.hex-map-inner {
  position: relative;
}
</style>