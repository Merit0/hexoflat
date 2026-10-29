<template>
  <span class="token" :class="`token--${size}`" :style="style" aria-hidden="true">
    <span v-for="layer in layers" :key="layer" class="token__layer" :style="layerStyle(layer)" />
    <span class="token__face">
      <img class="token__art" :src="isLoot ? lootUrl : tokenUrl" alt="" />
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Threat } from '@hexoflat/engine/encounters/threat';
import { ENCOUNTER_LOOT_URL, ENCOUNTER_RIMS, encounterTokenUrl } from '@/render/encounter-look';

const props = defineProps<{
  leaderKind: string;
  count: number;
  threat: Threat;
  scouted: boolean;
  sentry: boolean;
  boss: boolean;
  isLoot: boolean;
  size: 'map' | 'list' | 'guide';
}>();

const tokenUrl = computed(() => encounterTokenUrl(props.leaderKind));
const lootUrl = ENCOUNTER_LOOT_URL;
const STEP = { map: 5, list: 3, guide: 4 } as const;

const rim = computed(() => ENCOUNTER_RIMS[props.isLoot ? 'loot' : props.threat]);
const layers = computed(() =>
  props.isLoot ? [] : Array.from({ length: props.count - 1 }, (_, i) => props.count - 1 - i),
);
const style = computed(() => ({
  '--rim-light': rim.value.light,
  '--rim-dark': rim.value.dark,
}));

function layerStyle(layer: number) {
  return { transform: `translateY(${layer * STEP[props.size]}px)` };
}
</script>

<style scoped>
.token {
  position: relative;
  display: inline-block;
  flex: none;
  --hex: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
}
.token--map {
  width: 48px;
  height: 55px;
}
.token--guide {
  width: 40px;
  height: 46px;
}
.token--list {
  width: 26px;
  height: 30px;
}
.token__layer,
.token__face {
  position: absolute;
  inset: 0;
  clip-path: var(--hex);
}
.token__layer {
  background: var(--rim-dark);
}
.token__face {
  display: grid;
  place-items: center;
  background: linear-gradient(160deg, var(--rim-light), var(--rim-dark));
}
.token__face::after {
  content: '';
  position: absolute;
  inset: 3px;
  clip-path: var(--hex);
  background: #15171c;
}
.token__art {
  position: relative;
  z-index: 1;
  width: 58%;
  height: 58%;
  object-fit: contain;
}
</style>
