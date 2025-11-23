<template>
  <div
      class="initialTileView battle-grid-tile"
      :style="getTileBackgroundImage(tile)"
  >
    <div class="grave-tile"
         :style="getGraveImage(tile)"
         :class="{ glowing: hasGraveLoot }"
         @click="hasGraveLoot && openGraveInventory(tile)"
    >
      <div v-if="hasGraveLoot" class="grave-info-icon">i</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed, defineProps} from 'vue';
import TileModel from '@/a-game-scenes/homeland-scene/models/tile-model';
import {useGraveStore} from '@/stores/grave-store';
import {useOverlayStore} from "@/stores/overlay-store";
import {EnemyType} from "@/enums/EnemyType";

const graveStore = useGraveStore();
const overlayStore = useOverlayStore();

const props = defineProps<{
  tile: TileModel
}>();

const hasGraveLoot = computed(() => {
  return props.tile.grave?.graveTreasureItems.some(item => item?.name) ?? false;
});

const getTileBackgroundImage = (tile: TileModel) => {
  return {
    backgroundImage: `url(${tile.backgroundSrc})`,
    'background-size': '100% 100%'
  }
}

const getGraveImage = () => {
  const skeletonType: string = graveStore.killedEnemyType !== EnemyType.ANIMAL ? 'skeleton' : 'animal';
  const path = `/src/a-game-scenes/battlefield-scene/battlefield/assets/dead-${skeletonType}-tile-image.png`;
  return {
    backgroundImage: `url(${path})`,
  }
};

const openGraveInventory = (tile: TileModel) => {
  if (
      tile.isGrave &&
      tile.grave &&
      tile.grave.graveTreasureItems.some(item => item.name)
  ) {
    graveStore.buildGraveFromTile(tile);
    overlayStore.openOverlay('grave-inventory');
  }
};

</script>

<style scoped>
@import "@/a-game-scenes/battlefield-scene/battlefield/styles/battlefield-map-tile-style.css";
@import "@/a-game-scenes/battlefield-scene/battlefield/styles/battle-grave-tile-style.css";
</style>