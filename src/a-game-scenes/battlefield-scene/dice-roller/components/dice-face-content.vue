<template>
  <img
      v-if="isActionFace(face)"
      :src="`/src/a-game-scenes/battlefield-scene/dice-roller/assets/dice-face-icons/dice-${face}-face-image.png`"
      :alt="face"
      class="dice-face-image"
  />
  <dice-enemy-face v-else :face="face"/>
</template>

<script setup lang="ts">
import {defineProps} from 'vue';
import {DiceFace} from "@/a-game-scenes/battlefield-scene/dice-roller/models/DiceModel";
import DiceEnemyFace from "@/a-game-scenes/battlefield-scene/dice-roller/components/dice-enemy-face.vue";

defineProps<{
  face: 'sword' | 'shield' | 'energy' | `x${number}`;
}>();

const isActionFace = (face: DiceFace) => {
  return ['sword', 'shield', 'energy'].includes(face);
};
</script>

<style scoped>
.dice-face-image {
  width: 100%;
  height: 100%;
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
}
</style>