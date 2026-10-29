<template>
  <span class="token" :class="`token--${size}`" :style="style" aria-hidden="true">
    <span v-for="layer in layers" :key="layer" class="token__layer" :style="layerStyle(layer)" />
    <span class="token__face">
      <img class="token__art" :src="isLoot ? lootUrl : tokenUrl" alt="" />
      <span v-if="glyph" class="token__glyph">{{ glyph }}</span>
    </span>
    <span v-if="!isLoot && count > 1" class="token__count">×{{ count }}</span>
    <span v-if="!isLoot && !scouted" class="token__unknown">?</span>
    <span v-if="!isLoot && sentry" class="token__eye">👁</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Threat } from '@hexoflat/engine/encounters/threat';
import {
  ENCOUNTER_LOOT_URL,
  ENCOUNTER_MARKS,
  ENCOUNTER_RIMS,
  encounterTokenUrl,
  leaderGlyph,
} from '@/render/encounter-look';

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
const glyph = computed(() => (props.isLoot ? '' : leaderGlyph(props.leaderKind)));
const style = computed(() => ({
  '--rim-light': rim.value.light,
  '--rim-dark': rim.value.dark,
  '--unknown-fill': ENCOUNTER_MARKS.unknown.fill,
  '--unknown-stroke': ENCOUNTER_MARKS.unknown.stroke,
  '--sentry-fill': ENCOUNTER_MARKS.sentry.fill,
  '--sentry-stroke': ENCOUNTER_MARKS.sentry.stroke,
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
.token__glyph {
  position: absolute;
  z-index: 2;
  top: 4%;
  font-size: 0.6em;
}
.token__count,
.token__unknown,
.token__eye {
  position: absolute;
  z-index: 3;
  display: grid;
  place-items: center;
  border-radius: 999px;
  font-family: Cinzel, serif;
  font-weight: 800;
  color: #f5ead0;
  line-height: 1;
}
.token__count {
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  min-width: 24px;
  height: 24px;
  padding: 0 4px;
  font-size: 0.7rem;
  border: 2px solid var(--rim-light);
  background: #15171c;
}
.token__unknown {
  right: -6px;
  top: -4px;
  width: 20px;
  height: 20px;
  font-size: 0.7rem;
  border: 2px solid var(--unknown-stroke);
  background: var(--unknown-fill);
}
.token__eye {
  left: -6px;
  top: -4px;
  width: 22px;
  height: 22px;
  font-size: 0.7rem;
  border: 2px solid var(--sentry-stroke);
  background: var(--sentry-fill);
}
.token--list .token__count,
.token--list .token__unknown,
.token--list .token__eye {
  transform: scale(0.65);
}
</style>
