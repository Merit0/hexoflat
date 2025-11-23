<template>
  <div class="hex-map">
    <div class="hex-map-wrapper" :style="{ transform: `scale(${scale})` }">
      <hex-tile
          v-for="tile in tiles"
          :key="tile.id"
          :hex-tile="tile"/>
    </div>
  </div>
</template>

<script setup lang="ts">
import {ref, onMounted, onBeforeUnmount} from 'vue';
import type {HexTileModel} from '@/a-game-scenes/homeland-scene/models/hex-tile-model';
import {useWorldMapStore} from "@/stores/world-map-store";
import HexTile from "@/a-game-scenes/homeland-scene/components/hex-tile.vue";

const store = useWorldMapStore();
store.loadFromStorage();
store.generateIfEmpty();


const tiles = ref<HexTileModel[]>([]);
tiles.value = store.map.tiles;


const baseWidth = 1760;
const baseHeight = 700;
const scale = ref(1);

function updateScale() {
  const scaleX = window.innerWidth / baseWidth;
  const scaleY = window.innerHeight / baseHeight;
  scale.value = Math.min(scaleX, scaleY); // однаковий масштаб по обом осям
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
  width: 100%;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-image: url("@/a-game-scenes/homeland-scene/assets/dark-background.png");
}

.hex-map-wrapper {
  position: relative;
  width: 92%;
  height: 90%;
  transform-origin: center center;
  overflow: hidden;
}
</style>