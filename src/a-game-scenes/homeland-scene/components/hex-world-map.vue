<template>
  <div class="hex-map game-root">
    <div class="hex-map-wrapper" :style="{ transform: `scale(${scale})` }">
      <div
          class="hex-map-inner"
          :style="{
          width: mapBounds.width + 'px',
          height: mapBounds.height + 'px',
          transform: `translate(${-mapBounds.offsetX}px, ${-mapBounds.offsetY}px)`,
        }"
      >
        <hero-hex-tile
            :coord="store.heroCoordinates"
            :tileWidth="tileWidth"
        />
        <tool-hex-tile
            v-if="heroToolStore.isDragging && activeTool"
            :coord="heroToolStore.hover"
            :tileWidth="tileWidth"
            :tool="activeTool"
            :actionHint="heroToolStore.hintLabel || undefined"
            @hide="heroToolStore.stopTool()"
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
import {computed, onBeforeUnmount, onMounted, ref, watch} from "vue";
import type {HexTileModel} from "@/a-game-scenes/homeland-scene/models/hex-tile-model";
import {useWorldMapStore} from "@/stores/world-map-store";
import HexTile from "@/a-game-scenes/homeland-scene/components/hex-tile.vue";
import HeroHexTile from "@/a-game-scenes/homeland-scene/components/hero-hex-tile.vue";
import ToolHexTile from "@/a-game-scenes/homeland-scene/components/tool-hex-tile.vue";
import {calcHexPixelPosition} from "@/utils/tile-utils";
import {useTileClick} from "@/composables/use-tile-click";
import {useHeroToolStore} from "@/stores/hero-tool-store";
import {resolveActions} from "@/game-resolvers/interactions-resolver";
import {HeroToolType} from "@/enums/hero-tool-type";

const { handleTileClick } = useTileClick();
const store = useWorldMapStore();
const heroToolStore = useHeroToolStore();
const worldMapStore = useWorldMapStore();

store.loadFromStorage();
store.generateIfEmpty();

const tiles = computed<HexTileModel[]>(() => store.map?.tiles ?? []);
const activeTool = computed(() => heroToolStore.activeTool);
const GRID_COLUMNS = 42;

const scale = ref(1);
const tileWidth = window.innerWidth / GRID_COLUMNS;
const rowStep = computed(() => tileWidth * Math.sqrt(3));

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
      if (!tile) {
        heroToolStore.clearResolvedActions();
        return;
      }

      const obj = tile.hexobject ?? null;
      if (!obj) {
        heroToolStore.clearResolvedActions();
        return;
      }

      if (!obj.isInteractable || !obj.isInteractable) {
        heroToolStore.clearResolvedActions();
        return;
      }

      const actions = resolveActions(tool, obj);
      heroToolStore.setResolvedActions(actions);
    },
    { immediate: true }
);

const mapBounds = computed(() => {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const t of tiles.value) {
    const { x, y } = calcHexPixelPosition(t, tileWidth);

    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    return { width: 0, height: 0, offsetX: 0, offsetY: 0 };
  }

  return {
    // ширина одного кроку по X у формулі: x = tileWidth * 1.5 * q
    // але для bounds достатньо додати tileWidth як “приблизну ширину елемента” (для overflow)
    width: maxX - minX + tileWidth,
    // по Y додаємо “крок ряду”, щоб крайній ряд не обрізався
    height: maxY - minY + rowStep.value,
    offsetX: minX,
    offsetY: minY,
  };
});

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") heroToolStore.stopTool();
}

function updateScale() {
  if (mapBounds.value.width <= 0 || mapBounds.value.height <= 0) return;

  const padding = 40;

  const sx = (window.innerWidth - padding) / mapBounds.value.width;
  const sy = (window.innerHeight - padding) / mapBounds.value.height;

  scale.value = Math.min(sx, sy, 1);
}

watch(mapBounds, () => updateScale(), { immediate: true });

onMounted(() => {
  window.addEventListener("resize", updateScale);
  window.addEventListener("keydown", onKey)
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", updateScale);
  window.removeEventListener("keydown", onKey)
});
</script>

<style scoped>
@import "@/a-game-scenes/homeland-scene/styles/hex-tile-terrain-background-style.css";

.hex-map {
  display: grid;
  place-items: center;
  width: 100svw;
  height: 100svh;
  background-image: url("@/a-game-scenes/homeland-scene/assets/game-board.png");
  background-size: 100% 100%;
  background-position: center;
  background-repeat: no-repeat;
  overflow: clip;
}

.hex-map-wrapper {
  position: relative;
  transform-origin: center;
  display: grid;
  place-items: center;
}

.hex-map-inner {
  position: relative;
  width: max-content;
  height: max-content;
}
</style>