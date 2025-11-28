<template>
  <div class="hex-map game-root">
    <div
        class="hex-map-wrapper"
        :style="{ transform: `scale(${scale})` }"
    >
      <div
          class="hex-map-inner"
          :style="{
        width: mapBounds.width + 'px',
        height: mapBounds.height + 'px',
        transform: `translate(${-mapBounds.offsetX}px, ${-mapBounds.offsetY}px)`
      }"
      >
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
import {ref, onMounted, onBeforeUnmount, computed} from 'vue';
import type {HexTileModel} from '@/a-game-scenes/homeland-scene/models/hex-tile-model';
import {useWorldMapStore} from "@/stores/world-map-store";
import HexTile from "@/a-game-scenes/homeland-scene/components/hex-tile.vue";
import {calcHexPixelPosition} from "@/utils/tile-utils";
import {useTileClick} from "@/composables/use-tile-click";
const { handleTileClick } = useTileClick();

const store = useWorldMapStore();
store.loadFromStorage();
store.generateIfEmpty();


const tiles = ref<HexTileModel[]>([]);
tiles.value = store.map.tiles;

const DESIGN_COLS = 41;
const scale = ref(1);

const tileWidth = window.innerWidth / DESIGN_COLS;
const tileHeight = tileWidth * 1.01;

const mapBounds = computed(() => {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const t of tiles.value) {
    const { x, y } = calcHexPixelPosition(t, tileWidth, tileHeight);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  return {
    width: maxX - minX + tileWidth,
    height: maxY - minY + tileHeight,
    offsetX: minX,
    offsetY: minY
  };
});


function updateScale() {
  const sx = window.innerWidth / tileWidth;
  const sy = window.innerHeight / tileHeight;
  return Math.min(sx, sy);
}

onMounted(() => {
  updateScale();
  window.addEventListener('resize', updateScale);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateScale);
});

</script>
<style scoped>
@import "@/a-game-scenes/homeland-scene/styles/hex-tile-terrain-background-style.css";

.hex-map {
  display: grid;
  place-items: center;
  width: 100svw;
  height: 100svh;
  background-image: url("@/a-game-scenes/homeland-scene/assets/dark-background.png");
  background-size: cover;
  background-position: center;
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