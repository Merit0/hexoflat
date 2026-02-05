<template>
  <div
      class="initialTileView battle-grid-tile"
  >
    <div class="damage-popup" v-if="damageValue">
      -{{ damageValue }}
    </div>
    <div class="blood-splash" v-if="bloodSplash"/>
    <div
        class="battle-tile"
        @click="openInventory"
    >
      <div
          class="hero-rotator battle-tile"
          :class="{ spinning: battleStore.isHeroAttacking }"
      >
        <hero-top-view
            container="battle-hero-view"
            scale="0.25"
            test-id="battle-hero-top-view-container"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed, defineProps} from "vue";
import TileModel from '@/a-game-scenes/map-scene/models/tile-model';
import {useBattleStore} from "@stores/battle-store";
import {useHeroStore} from "@stores/hero-store";

const battleStore = useBattleStore();
const heroStore = useHeroStore()

const props = defineProps<{
  tile: TileModel
}>();

const damageValue = computed(() => {
  return battleStore.damagePopups[props.tile.id] || null
});

const bloodSplash = computed(() => {
  return battleStore.bloodSplashTiles.includes(props.tile.id)
});

const openInventory = () => {
  heroStore.inventoryShown = true
}

</script>

<style scoped>
@import "../../styles/battlefield-map-tile-style.css";
@import "../../styles/battle-effects-style.css";

.hero-rotator.spinning {
  animation: hero-spin 0.5s linear;
  will-change: transform;
}

@keyframes hero-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>