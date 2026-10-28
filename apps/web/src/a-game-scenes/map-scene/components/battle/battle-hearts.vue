<template>
  <span class="battle-hearts">
    <span class="battle-hearts__nests" :style="{ '--size': `${size}px` }">
      <hero-heart-slot
        v-for="nest in nests"
        :key="nest.index"
        class="battle-hearts__nest"
        :fill="nest.fill"
      />
    </span>
    <span class="battle-hearts__value">{{ hp / 2 }} / {{ maxHp / 2 }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import HeroHeartSlot from '@/a-game-scenes/map-scene/components/hero-details/hero-heart-slot.vue';

const props = withDefaults(defineProps<{ hp: number; maxHp: number; size?: number }>(), {
  size: 22,
});

const nests = computed(() =>
  Array.from({ length: Math.ceil(props.maxHp / 2) }, (_, index) => ({
    index,
    fill: Math.max(0, Math.min(1, props.hp / 2 - index)),
  })),
);
</script>

<style scoped>
.battle-hearts {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.battle-hearts__nests {
  display: inline-flex;
  gap: 2px;
}
.battle-hearts__nest {
  width: var(--size);
}
.battle-hearts__value {
  color: #cbbfa6;
  font-family: Cinzel, serif;
  font-size: 0.85rem;
  font-weight: 700;
}
</style>
