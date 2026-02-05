<template>
  <div class="battle-arena-wrapper">
    <div class="battle-tiles-grid" v-if="tile">
      <battle-map-tile
          v-for="tile in tiles"
          :key="tile.id"
          :tile="tile"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import {useBattleStore} from '@stores/battle-store'
import TileModel from "@/a-game-scenes/map-scene/models/tile-model";
import {defineProps} from "vue";
import BattleMapTile from "./battle-map-tile.vue";

const props = defineProps<{
  tile: TileModel | null
}>()
const battleStore = useBattleStore()
const tiles = battleStore.tiles
</script>

<style>
.battle-arena-wrapper {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
}

.battle-tiles-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(5, 10vh);
  grid-template-rows: repeat(5, 10vh);
  gap: 0.3rem;
}

.battle-grid-tile {
  height: 10vh;
  aspect-ratio: 1 / 1;
  box-sizing: border-box;
  background-size: 100% 100%;
  flex-shrink: 0;
  border-radius: 4px;
  justify-content: center;
  align-items: center;
  align-content: center;
}
</style>