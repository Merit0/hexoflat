<template>
  <div class="nests" data-testid="hero-shield-nests">
    <svg
      v-for="i in total"
      :key="i"
      class="nest"
      :class="{ 'is-filled': i <= filled }"
      viewBox="0 0 24 24"
      aria-hidden="true"
      :data-testid="`hero-shield-nest-${i}`"
    >
      <path :d="NEST_PATH" />
    </svg>
  </div>
</template>

<script setup lang="ts">
defineProps<{ filled: number; total: number }>();

const NEST_PATH = 'M12 2 L21 7 V17 L12 22 L3 17 V7 Z';
</script>

<style scoped>
.nests {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.nest {
  width: 22px;
  height: 22px;
  fill: transparent;
  stroke: #7fb4e8;
  stroke-width: 1.4;
  stroke-linejoin: round;
}
.nest.is-filled {
  fill: #7fb4e8;
}
</style>
