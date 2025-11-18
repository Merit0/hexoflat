<template>
  <div class="dice-wrapper">
    <div class="dice" :style="rotationStyle">
      <div class="face front">
        <dice-face-content :face="face"/>
      </div>
      <div class="face back">
        <dice-face-content :face="face"/>
      </div>
      <div class="face right">
        <dice-face-content :face="face"/>
      </div>
      <div class="face left">
        <dice-face-content :face="face"/>
      </div>
      <div class="face top">
        <dice-face-content :face="face"/>
      </div>
      <div class="face bottom">
        <dice-face-content :face="face"/>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed, defineProps, ref, watch} from 'vue';
import DiceFaceContent from "@/a-game-scenes/battlefield-scene/dice-roller/components/dice-face-content.vue";

const props = defineProps<{
  face: 'sword' | 'shield' | 'energy';
  isRolling: boolean;
}>();

const baseX = ref(0);
const baseY = ref(0);
const offsetX = ref(0);
const offsetY = ref(0);

watch(() => props.isRolling, (newVal, oldVal) => {
  if (newVal) {
    offsetX.value = 720 + Math.floor(Math.random() * 360);
    offsetY.value = 720 + Math.floor(Math.random() * 360);
  } else if (oldVal && !newVal) {
    const {x, y} = getRotationForFace(props.face);
    baseX.value = x;
    baseY.value = y;
    offsetX.value = 0;
    offsetY.value = 0;
  }
});

const rotationStyle = computed(() => {
  const x = baseX.value + offsetX.value;
  const y = baseY.value + offsetY.value;
  return `transform: rotateX(${x}deg) rotateY(${y}deg);`;
});

function getRotationForFace(face: string): { x: number; y: number } {
  switch (face) {
    case 'sword':
      return {x: 0, y: 0};
    case 'shield':
      return {x: 0, y: 180};
    case 'energy':
      return {x: 90, y: 0};
    default:
      return {x: 0, y: 0};
  }
}
</script>

<style scoped>
.dice-wrapper {
  width: 3vw;
  height: 3vw;
  perspective: 600px;
}

.dice {
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 1.5s cubic-bezier(0.23, 1, 0.32, 1);
  position: relative;
}

.face {
  position: absolute;
  width: 100%;
  height: 100%;
  background: radial-gradient(
      circle,
      #fffde7 0%,
      #fff9c4 10%,
      #fff59d 20%,
      #fff176 30%,
      #ffee58 40%,
      #ffeb3b 50%,
      #fdd835 60%,
      #fbc02d 70%,
      #f9a825 85%,
      #f57f17 100%
  );

  display: flex;
  align-items: center;
  justify-content: center;
  backface-visibility: hidden;
  border-radius: 0.5rem;
  border: 1px solid rgba(0, 0, 0, 0.15);
  box-shadow: inset 0 0 4px rgba(255, 255, 255, 0.2),
  0 2px 4px rgba(0, 0, 0, 0.2);
}

.face img {
  width: 80%;
  height: 80%;
  object-fit: contain;
}

.front {
  transform: rotateY(0deg) translateZ(1.4vw);
}

.back {
  transform: rotateY(180deg) translateZ(1.4vw);
}

.right {
  transform: rotateY(90deg) translateZ(1.4vw);
}

.left {
  transform: rotateY(-90deg) translateZ(1.4vw);
}

.top {
  transform: rotateX(90deg) translateZ(1.4vw);
}

.bottom {
  transform: rotateX(-90deg) translateZ(1.4vw);
}
</style>