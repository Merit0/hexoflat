<template>
  <section class="section">
    <div class="head" :data-testid="`${testPrefix}-head`">
      <span class="label" :data-testid="`${testPrefix}-label`">{{ label }}</span>
      <span class="value" :data-testid="`${testPrefix}-value`">
        <b>{{ current }}</b
        ><small> /{{ max }}</small>
      </span>
    </div>

    <div class="nests" :style="{ '--slots': slotCount }" :data-testid="`${testPrefix}-nests`">
      <template v-if="kind === 'heart'">
        <hero-heart-slot
          v-for="slot in slots"
          :key="slot.index"
          :fill="slot.fill"
          :data-testid="`${testPrefix}-nest-${slot.index}`"
        />
      </template>

      <template v-else>
        <hero-shield-slot
          v-for="slot in slots"
          :key="slot.index"
          :fill="slot.fill"
          :data-testid="`${testPrefix}-nest-${slot.index}`"
        />
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import HeroHeartSlot from './hero-heart-slot.vue';
import HeroShieldSlot from './hero-shield-slot.vue';

export type VitalKind = 'heart' | 'shield';

const props = defineProps<{
  kind: VitalKind;
  label: string;
  current: number;
  max: number;
  slotCount: number;
  testPrefix: string;
}>();

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
  display: grid;
  grid-template-columns: repeat(var(--slots), minmax(0, 64px));
  gap: 0;
}
</style>
