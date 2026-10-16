<template>
  <div class="hearts" data-testid="hero-hearts">
    <svg
      v-for="i in count"
      :key="i"
      class="heart"
      viewBox="0 0 24 24"
      aria-hidden="true"
      :data-testid="`hero-heart-${i}`"
    >
      <defs>
        <clipPath :id="`hero-heart-clip-${i}`" clipPathUnits="objectBoundingBox">
          <rect x="0" y="0" :width="fill(i - 1)" height="1" />
        </clipPath>
      </defs>
      <path :d="HEART_PATH" class="heart__bg" />
      <path :d="HEART_PATH" class="heart__fg" :clip-path="`url(#hero-heart-clip-${i})`" />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { HEART_PATH } from '@/a-game-scenes/map-scene/icon-paths';

const props = defineProps<{ current: number; count: number }>();

function fill(index: number): number {
  return Math.max(0, Math.min(1, props.current - index));
}
</script>

<style scoped>
.hearts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.heart {
  width: 24px;
  height: 24px;
}
.heart__bg {
  fill: rgba(255, 255, 255, 0.1);
}
.heart__fg {
  fill: #f06a5a;
}
</style>
