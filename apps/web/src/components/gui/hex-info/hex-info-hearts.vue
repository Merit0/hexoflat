<template>
  <div class="hearts" :class="{ 'is-large': large }" data-testid="hex-info-hearts">
    <span v-for="(fill, index) in hearts.fills" :key="index" class="heart" :data-fill="fill">
      <img class="heart__base" :src="HEART_ICON_URL" alt="" />
      <span class="heart__fill" :style="{ width: `${fill * 100}%` }">
        <img class="heart__img" :src="HEART_ICON_URL" alt="" />
      </span>
    </span>
    <strong class="hearts__value" data-testid="hex-info-hearts-value">
      {{ formatNumber(hearts.value) }}/{{ formatNumber(hearts.max) }}
    </strong>
  </div>
</template>

<script setup lang="ts">
import type { HexInfoHearts } from '@/services/hex-info/build-hex-info';

const HEART_ICON_URL = '/board-assets/hero-board/heart-icon.png';

defineProps<{ hearts: HexInfoHearts; large?: boolean }>();

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
</script>

<style scoped>
.hearts {
  --heart: 20px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 3px;
}
.hearts.is-large {
  --heart: 18px;
}
.heart {
  position: relative;
  width: var(--heart);
  height: var(--heart);
}
.heart__base {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: grayscale(1) brightness(0.35);
}
.heart__fill {
  position: absolute;
  inset: 0 auto 0 0;
  overflow: hidden;
}
.heart__img {
  width: var(--heart);
  height: var(--heart);
  max-width: none;
  object-fit: contain;
}
.hearts__value {
  margin-left: 6px;
  color: var(--muted);
  font-size: 0.82rem;
}
</style>
