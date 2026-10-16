<template>
  <hero-details-card class="row" :accent="color" :style="{ '--rarity': color }">
    <span class="row__label" data-testid="hero-hand-label">{{ label }}</span>
    <span class="row__divider" data-testid="hero-hand-divider"></span>
    <span v-if="title" class="row__name" data-testid="hero-hand-name">{{ title }}</span>
    <span v-else class="row__empty" data-testid="hero-hand-empty">{{ emptyLabel }}</span>
  </hero-details-card>
</template>

<script setup lang="ts">
import HeroDetailsCard from './hero-details-card.vue';

defineProps<{ label: string; title: string | null; emptyLabel: string; color: string }>();
</script>

<style scoped>
.row {
  grid-template-columns: minmax(0, 9rem) 2px 1fr;
  align-items: center;
  gap: 16px;
  min-height: 60px;
  padding-top: 0;
  padding-bottom: 0;
}
.row__label {
  color: #cbbfa6;
  font-family: 'Alegreya SC', serif;
  font-size: 1.1rem;
  letter-spacing: 0.04em;
}
.row__divider {
  align-self: stretch;
  margin: 12px 0;
  border-radius: 2px;
  background: var(--rarity);
  opacity: 0.8;
}
.row__name {
  min-width: 0;
  color: var(--rarity);
  font-family: 'Alegreya SC', serif;
  font-size: 1.25rem;
  font-weight: 700;
}
.row__empty {
  color: #a39886;
  font-style: italic;
}
</style>
