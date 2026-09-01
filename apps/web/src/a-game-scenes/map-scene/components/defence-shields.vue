<template>
  <div class="icon-row">
    <svg v-for="i in SHIELD_COUNT" :key="i" class="icon" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <clipPath :id="`defence-clip-${i}`" clipPathUnits="objectBoundingBox">
          <rect x="0" y="0" :width="fillPercent(i - 1) / 100" height="1" />
        </clipPath>
      </defs>
      <path :d="SHIELD_PATH" class="icon__bg" />
      <path :d="SHIELD_PATH" class="icon__fg" :clip-path="`url(#defence-clip-${i})`" />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { SHIELD_PATH } from '@/a-game-scenes/map-scene/icon-paths';

const props = defineProps<{ percent: number }>();

const SHIELD_COUNT = 6;

/**
 * Each shield's fill 0-100%, split proportionally across SHIELD_COUNT slots.
 * Fed into an SVG clipPath with objectBoundingBox units (0-1 fractional), so
 * the reveal mask stays exact regardless of the shield's rendered pixel size.
 */
function fillPercent(shieldIndex: number): number {
  const filled = (props.percent / 100) * SHIELD_COUNT;
  return Math.round(Math.max(0, Math.min(1, filled - shieldIndex)) * 100);
}
</script>

<style scoped>
.icon-row {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  height: 100%;
  padding: 5px 0;
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
  fill: #7ec8ff;
  filter: drop-shadow(0 0 3px rgba(126, 200, 255, 0.6));
}
</style>
