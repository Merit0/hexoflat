<template>
  <div class="enemy-face">
    <img src="/src/a-game-scenes/battlefield-scene/dice-roller/assets/dice-face-icons/enemy-dice-face-image.png" alt="enemy-face-icon"/>
    <span class="enemy-count">{{ number }}</span>
  </div>
</template>

<script setup lang="ts">
import {defineProps, computed} from 'vue';

const props = defineProps<{
  face: `x${number}`;
}>();

const number = computed(() => parseInt(props.face.slice(1)));
</script>

<style scoped>
.enemy-face {
  position: absolute;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.enemy-face img {
  width: 160%;
  height: 160%;
  background-size: cover;
  filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.2));
}

.enemy-count {
  position: absolute;
  top: 10%;
  font-size: 1vw;
  font-weight: bold;
  color: #ffe600;
  text-shadow: 0 0 4px #000, 0 0 6px #000;
}
</style>