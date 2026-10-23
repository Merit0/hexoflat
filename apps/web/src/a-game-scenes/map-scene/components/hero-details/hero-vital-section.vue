<template>
  <section class="section">
    <div class="head" :data-testid="`${testPrefix}-head`">
      <span class="label" :data-testid="`${testPrefix}-label`">{{ label }}</span>
      <span class="value" :data-testid="`${testPrefix}-value`">
        <b>{{ current }}</b
        ><small> /{{ max }}</small>
      </span>
    </div>

    <div
      class="nests"
      :class="`nests--${kind}`"
      :style="{ '--slots': slotCount }"
      :data-testid="`${testPrefix}-nests`"
    >
      <template v-if="kind === 'heart'">
        <hero-heart-slot
          v-for="slot in slots"
          :key="slot.index"
          :fill="slot.fill"
          :data-testid="`${testPrefix}-nest-${slot.index}`"
        />
      </template>

      <template v-else>
        <svg class="defs" width="0" height="0" aria-hidden="true">
          <defs>
            <linearGradient id="vital-outer" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#7fb0ff" />
              <stop offset="1" stop-color="#2c55c4" />
            </linearGradient>
            <linearGradient id="vital-inner" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#3f7be8" />
              <stop offset="1" stop-color="#2748b0" />
            </linearGradient>
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
          <path class="nest__empty" :d="SHIELD_PATH" :transform="OUTER_TRANSFORM" />
          <path
            class="nest__empty nest__empty--dashed"
            :d="SHIELD_PATH"
            :transform="INNER_TRANSFORM"
          />
          <g v-if="slot.fill > 0">
            <path
              class="nest__outer"
              :d="SHIELD_PATH"
              :transform="OUTER_TRANSFORM"
              fill="url(#vital-outer)"
              stroke="#9cc2ff"
            />
            <path
              class="nest__inner"
              :d="SHIELD_PATH"
              :transform="INNER_TRANSFORM"
              fill="url(#vital-inner)"
            />
            <circle class="nest__dot-ring" cx="24" cy="23" r="5" />
            <circle class="nest__dot" cx="24" cy="23" r="3.4" />
          </g>
        </svg>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import HeroHeartSlot from './hero-heart-slot.vue';

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
const OUTER_TRANSFORM = 'translate(8.4 8.4) scale(1.3)';
const INNER_TRANSFORM = 'translate(10.8 10.9) scale(0.9)';

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
.nests--heart {
  display: grid;
  grid-template-columns: repeat(var(--slots), minmax(0, 64px));
  gap: 0;
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
