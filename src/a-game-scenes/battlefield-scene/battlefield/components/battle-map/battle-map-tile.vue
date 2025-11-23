<template>
  <transition name="fade-in-scale" mode="out-in">
    <battle-enemy-tile
        v-if="tile.isEnemyHere && enemyAlive"
        :tile="tile"
        :data-tile-id="tile.id"
    >
    </battle-enemy-tile>
    <battle-hero-tile
        v-else-if="tile.isHeroHere"
        :tile="tile"
        :data-tile-id="tile.id"
    >
    </battle-hero-tile>
    <battle-grave-tile
        v-else-if="tile.isGrave"
        :tile="tile"
        :data-tile-id="tile.id"
    >
    </battle-grave-tile>
    <div v-else class="battle-grid-tile" :data-tile-id="tile.id"/>
  </transition>
</template>

<script setup lang="ts">
import {computed, defineProps} from 'vue';
import TileModel from '@/a-game-scenes/homeland-scene/models/tile-model';
import BattleEnemyTile from "@/a-game-scenes/battlefield-scene/battlefield/components/battle-map/battle-enemy-tile.vue";
import BattleHeroTile from "@/a-game-scenes/battlefield-scene/battlefield/components/battle-map/battle-hero-tile.vue";
import BattleGraveTile from "@/a-game-scenes/battlefield-scene/battlefield/components/battle-map/battle-grave-tile.vue";

const props = defineProps<{
  tile: TileModel
}>();

const enemyAlive = computed(() => {
  return props.tile.enemies.some(e => e.health > 0);
});

</script>
<style>
.battle-tile {
  width: 100%;
  height: 100%;
  position: relative;
}
</style>