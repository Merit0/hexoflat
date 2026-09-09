<template>
  <div class="icon-row">
    <svg v-for="i in HEART_COUNT" :key="i" class="icon" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <clipPath :id="`hp-clip-${i}`" clipPathUnits="objectBoundingBox">
          <rect x="0" y="0" :width="fillPercent(i - 1) / 100" height="1" />
        </clipPath>
      </defs>
      <path :d="HEART_PATH" class="icon__bg" />
      <path :d="HEART_PATH" class="icon__fg" :clip-path="`url(#hp-clip-${i})`" />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { HEART_PATH } from '@/a-game-scenes/map-scene/icon-paths';

const props = defineProps<{ percent: number }>();

const HEART_COUNT = 10;

/**
 * Each heart's fill 0-100%, split proportionally across HEART_COUNT slots.
 * Fed into an SVG clipPath with objectBoundingBox units (0-1 fractional), so
 * the reveal mask stays exact regardless of the heart's rendered pixel size.
 */
function fillPercent(heartIndex: number): number {
  const filled = (props.percent / 100) * HEART_COUNT;
  return Math.round(Math.max(0, Math.min(1, filled - heartIndex)) * 100);
}
</script>

<style scoped>
.icon-row {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 100%;
  height: 100%;
  padding: 15.3px 0;
  box-sizing: border-box;
}

.icon {
  flex: none;
  height: 100%;
  aspect-ratio: 1 / 1;
}

.icon__bg {
  fill: rgba(255, 255, 255, 0.12);
}

.icon__fg {
  fill: #ff5470;
  filter: drop-shadow(0 0 3px rgba(255, 84, 112, 0.6));
}
</style>
