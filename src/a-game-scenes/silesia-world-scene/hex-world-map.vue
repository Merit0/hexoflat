<template>
  <div class="hex-map">
    <div class="hex-map-wrapper" :style="{ transform: `scale(${scale})` }">
      <div
          v-for="tile in tiles"
          :key="tile.id"
          class="hex-tile"
          :class="tile.terrain"
          :style="getHexTileTransformStyle(tile)"
          @click="tile.terrain !== 'sea' && tile.terrain !== 'deep-sea' ? onTileClick(tile) : null"
      >
        <div
            :class="`hex-tile-img-${tile.terrain}`"
            :style="getTileTerrainImage(tile)"
        ></div>
        <div v-if="tile.isBlocked" class="tile-lock">
          <span class="lock-icon">🔒</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {ref, onMounted, onBeforeUnmount} from 'vue';
import {useRouter} from 'vue-router';
import type {HexTileModel} from '@/a-game-scenes/silesia-world-scene/models/hex-tile-model';
import {useHeroStore} from "@/stores/hero-store";
import {HeroModel} from "@/models/HeroModel";
import {useWorldMapStore} from "@/stores/world-map-store";

const router = useRouter();
const store = useWorldMapStore();
store.loadFromStorage();
store.generateIfEmpty();


const tiles = ref<HexTileModel[]>([]);
tiles.value = store.map.tiles;


const baseWidth = 1600;
const baseHeight = 800;
const scale = ref(1);

function updateScale() {
  const scaleX = window.innerWidth / baseWidth;
  const scaleY = window.innerHeight / baseHeight;
  scale.value = Math.min(scaleX, scaleY); // однаковий масштаб по обом осям
}

function getHexTileTransformStyle(tile: HexTileModel) {
  const tileWidth = window.innerWidth / 44.6;
  const tileHeight = tileWidth * 1.01;

  const x = tileWidth * (3 / 2) * tile.q;
  const y = Math.sqrt(3) * tileHeight * tile.r + (tile.q % 2 ? Math.sqrt(3) * tileHeight / 2 : 0);

  return {
    transform: `translate(${x}px, ${y}px)`
  };
}

function getTileTerrainImage(tile: HexTileModel) {
  return {
    backgroundImage: `url(${tile.imagePath})`,
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
  };
}

function onTileClick(tile: HexTileModel) {
  const roundTo = (num: number, decimals = 1): number => {
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
  }

  if (tile.terrain === 'sea' || tile.terrain === 'deep-sea') {
    return;
  }
  const hero: HeroModel = useHeroStore().hero;
  const worldMapStore = useWorldMapStore();
  if (tile.isBlocked) {
    if (hero.getHeroMyriads() >= tile.requiredMyriads) {
      tile.isBlocked = false;
      worldMapStore.saveToStorage();
    } else {
      alert(`Need more ${roundTo(tile.requiredMyriads - hero.getHeroMyriads())} myriads, to unlock location.`);
      return;
    }
  }
  if (tile.regionKey && tile.regionKey !== 'camping') {
    router.push(`/location/${tile.regionKey}`);
  } else if (tile.regionKey && tile.regionKey === 'camping') {
    router.push(`/${tile.regionKey}`);
  } else {
    return new Error('Map region is not supported');
  }
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
@import "@/a-game-scenes/silesia-world-scene/styles/hex-tile-terrain-background-style.css";

.hex-map {
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #2e231d;
  overflow: hidden;
}

.hex-map-wrapper {
  position: relative;
  width: 85vw;
  height: 80vh;
  transform-origin: center center;
}

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
  transition: transform 0.25s ease, box-shadow 0.25s ease;
  cursor: pointer;
  transform-origin: center;
}

.hex-tile:hover {
  transform: scale(1.1);
  box-shadow: 0 0 12px rgba(0, 0, 0, 0.4);
  z-index: 10;
}

.tile-lock {
  position: absolute;
  width: 100%;
  height: 100%;
  background: rgba(128, 127, 127, 0.33);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: #fff;
  border-radius: 8px;
  pointer-events: none;
  z-index: 5;
}

.lock-icon {
  position: absolute;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
}
</style>