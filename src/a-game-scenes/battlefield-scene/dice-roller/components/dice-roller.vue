<template>
  <div class="dice-roller">
    <div class="dices">
      <dice-3d
          v-for="(dice, index) in diceStore.holder.dices"
          :key="index"
          :face="dice.face"
          :isRolling="dice.isRolling"
      ></dice-3d>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDiceStore } from '@/stores/DiceStore';
import Dice3d from "@/a-game-scenes/battlefield-scene/dice-roller/components/dice-3d.vue";

const diceStore = useDiceStore();
</script>

<style scoped>
.dice-roller {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}
.dices {
  display: flex;
  gap: 2rem;
}
</style>