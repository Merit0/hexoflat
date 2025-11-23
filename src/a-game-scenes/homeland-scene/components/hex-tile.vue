<template>
  <div
      class="hex-tile"
      :style="getHexTileTransformStyle(hexTile)"
  >
    <div
        :class="`hex-tile-img-${hexTile.tileType}`"
        :style="getHexTileImage(hexTile)"
    ></div>
  </div>
</template>

<script setup lang="ts">
import {ref, onMounted, onBeforeUnmount, defineProps} from 'vue';
import {useRouter} from 'vue-router';
import type {HexTileModel} from '@/a-game-scenes/homeland-scene/models/hex-tile-model';
import {useWorldMapStore} from "@/stores/world-map-store";

defineProps<{
  hexTile: HexTileModel;
}>();

// const router = useRouter();
const store = useWorldMapStore();


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

function getHexTileTransformStyle(tile: HexTileModel) {
  const tileWidth = window.innerWidth / 44.6;
  const tileHeight = tileWidth * 1.01;

  const x = tileWidth * (3 / 2) * tile.coordinates.columnIndex;
  const y = Math.sqrt(3) * tileHeight * tile.coordinates.rowIndex + (tile.coordinates.columnIndex % 2 ? Math.sqrt(3) * tileHeight / 2 : 0);

  return {
    transform: `translate(${x}px, ${y}px)`
  };
}

function getHexTileImage(tile: HexTileModel) {
  return {
    backgroundImage: `url(${tile.imagePath})`,
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
  };
}

// function onTileClick(tile: HexTileModel) {
//   if (tile.place === 'blocked' || tile.place === 'empty') {
//     console.log('Place is empty')
//     return;
//   }
//   if (tile.place !== 'home') {
//     router.push(`/location/${tile.placeKey}`);
//   } else if (tile.placeKey && tile.placeKey === 'home') {
//     router.push(`/${tile.placeKey}`);
//   } else {
//     return new Error('Map place is not supported');
//   }
// }

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

.hex-tile {
  width: var(--hex-tile-width);
  height: var(--hex-tile-height);
  position: absolute;
  clip-path: polygon(
      25% 0%, 75% 0%, 100% 50%,
      75% 100%, 25% 100%, 0% 50%
  );
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transform-origin: center;
}

.hex-tile:hover {
  transform: scale(1.1);
  box-shadow: 0 0 12px rgb(0, 0, 0);
  z-index: 10;
}
</style>