<template>
  <span class="hex-token" :class="[`is-${side}`, { 'is-active': active, 'is-fallen': fallen }]">
    <span class="hex-token__frame">
      <span class="hex-token__face" :style="{ backgroundImage: `url('${face}')` }"></span>
    </span>
    <span v-if="init !== null" class="hex-token__init">{{ init }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { BattleSide } from '@hexoflat/engine/battle/battle-state';
import { creatureSprite } from '@/render/creature-sprites';

const props = defineProps<{
  side: BattleSide;
  kind?: string;
  init: number | null;
  active?: boolean;
  fallen?: boolean;
}>();

const face = computed(() => creatureSprite(props.side, props.kind));
</script>

<style scoped>
.hex-token {
  position: relative;
  flex: none;
  width: 40px;
  height: 46px;
}
.hex-token__frame {
  position: absolute;
  inset: 0;
  clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
  background: linear-gradient(160deg, #6fa8e8, #1f4a88);
}
.is-enemies .hex-token__frame {
  background: linear-gradient(160deg, #b0306a, #4e0c27);
}
.is-active .hex-token__frame {
  background: linear-gradient(160deg, #f0c060, #8c5a12);
  filter: drop-shadow(0 0 6px rgb(140 28 71 / 70%));
}
.hex-token__face {
  position: absolute;
  inset: 3px;
  clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
  background-color: #1b2023;
  background-position: center;
  background-size: 120%;
}
.is-fallen {
  filter: grayscale(1) brightness(0.5);
}
.hex-token__init {
  position: absolute;
  top: -4px;
  left: -6px;
  display: grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  border-radius: 999px;
  background: #121517;
  border: 1px solid #36424a;
  color: #ede3d2;
  font-family: Cinzel, serif;
  font-size: 0.7rem;
  font-weight: 700;
}
</style>
