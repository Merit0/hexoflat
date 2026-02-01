<template>
  <div class="battle-area-container">
    <battle-grid v-if="realBattleTile" :tile="realBattleTile"/>
  </div>
</template>

<script setup lang="ts">
import BattleGrid from "./battle-grid.vue";
import {useRealBattleTile} from "@/composables/useRealBattleTile";

const {realBattleTile} = useRealBattleTile();
</script>


<style scoped>
.battle-area-container {
  position: relative;
  top: 7%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 60vw;
  height: 61vh;
}
</style>