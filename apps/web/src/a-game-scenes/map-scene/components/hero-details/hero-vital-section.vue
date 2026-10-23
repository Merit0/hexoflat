<template>
  <section class="section">
    <div class="head" :data-testid="`${testPrefix}-head`">
      <span class="label" :data-testid="`${testPrefix}-label`">{{ label }}</span>
      <span class="value" :data-testid="`${testPrefix}-value`">
        <b>{{ current }}</b
        ><small> /{{ max }}</small>
      </span>
    </div>

    <div class="nests" :data-testid="`${testPrefix}-nests`">
      <svg class="defs" width="0" height="0" aria-hidden="true">
        <defs>
          <linearGradient :id="`vital-outer-${kind}`" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" :stop-color="palette.outerFrom" />
            <stop offset="1" :stop-color="palette.outerTo" />
          </linearGradient>
          <linearGradient :id="`vital-inner-${kind}`" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" :stop-color="palette.innerFrom" />
            <stop offset="1" :stop-color="palette.innerTo" />
          </linearGradient>
          <clipPath
            v-for="slot in slots"
            :id="`vital-clip-${kind}-${slot.index}`"
            :key="slot.index"
          >
            <rect x="0" y="0" :width="48 * slot.fill" height="48" />
          </clipPath>
        </defs>
      </svg>

      <svg
        v-for="slot in slots"
        :key="slot.index"
        class="nest"
        viewBox="0 0 48 48"
        aria-hidden="true"
        :data-testid="`${testPrefix}-nest-${slot.index}`"
      >
        <circle class="nest__well" cx="24" cy="24" r="23" />
        <path class="nest__empty" :d="glyph.path" :transform="glyph.outer" />
        <path class="nest__empty nest__empty--dashed" :d="glyph.path" :transform="glyph.inner" />
        <g v-if="slot.fill > 0" :clip-path="`url(#vital-clip-${kind}-${slot.index})`">
          <path
            class="nest__outer"
            :d="glyph.path"
            :transform="glyph.outer"
            :fill="`url(#vital-outer-${kind})`"
            :stroke="palette.edge"
          />
          <path
            class="nest__inner"
            :d="glyph.path"
            :transform="glyph.inner"
            :fill="`url(#vital-inner-${kind})`"
          />
          <circle class="nest__dot-ring" :cx="glyph.dot.x" :cy="glyph.dot.y" r="5" />
          <circle class="nest__dot" :cx="glyph.dot.x" :cy="glyph.dot.y" r="3.4" />
        </g>
      </svg>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { HEART_PATH } from '@/a-game-scenes/map-scene/icon-paths';

export type VitalKind = 'heart' | 'shield';

const props = defineProps<{
  kind: VitalKind;
  label: string;
  current: number;
  max: number;
  slotCount: number;
  testPrefix: string;
}>();

const SHIELD_PATH = 'M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z';

const GLYPHS = {
  shield: {
    path: SHIELD_PATH,
    outer: 'translate(8.4 8.4) scale(1.3)',
    inner: 'translate(10.8 10.9) scale(0.9)',
    dot: { x: 24, y: 23 },
  },
  heart: {
    path: HEART_PATH,
    outer: 'translate(9.6 9.4) scale(1.2)',
    inner: 'translate(12 11.8) scale(0.8)',
    dot: { x: 24, y: 22.5 },
  },
} as const;

const PALETTES = {
  shield: {
    outerFrom: '#7fb0ff',
    outerTo: '#2c55c4',
    innerFrom: '#3f7be8',
    innerTo: '#2748b0',
    edge: '#9cc2ff',
  },
  heart: {
    outerFrom: '#ff9a8a',
    outerTo: '#c23a3a',
    innerFrom: '#f0604f',
    innerTo: '#a82f2f',
    edge: '#ffb8ac',
  },
} as const;

const glyph = computed(() => GLYPHS[props.kind]);
const palette = computed(() => PALETTES[props.kind]);

const slots = computed(() =>
  Array.from({ length: props.slotCount }, (_, index) => ({
    index: index + 1,
    fill: Math.max(0, Math.min(1, props.current - index)),
  })),
);
</script>

<style scoped>
.section {
  display: grid;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 14px;
  background: #29333a;
  border: 1px solid #3a474e;
}
.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.label {
  color: #ede3d2;
  font-family: 'Alegreya SC', serif;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.value {
  color: #cbbfa6;
}
.value b {
  color: #e8d7a8;
  font-size: 1.3rem;
  font-weight: 800;
}
.value small {
  font-size: 0.75rem;
}
.nests {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}
.defs {
  position: absolute;
}
.nest {
  flex: none;
  width: 48px;
  height: 48px;
}
.nest__well {
  fill: #14181c;
  stroke: #1f262c;
  stroke-width: 1;
}
.nest__empty {
  fill: none;
  stroke: #3f5470;
  stroke-width: 1.4;
  stroke-linejoin: round;
}
.nest__empty--dashed {
  stroke-width: 1;
  stroke-dasharray: 2 2.4;
}
.nest__outer {
  stroke-width: 0.6;
  stroke-linejoin: round;
}
.nest__dot-ring {
  fill: rgba(255, 255, 255, 0.18);
}
.nest__dot {
  fill: #f4f8ff;
}
</style>
