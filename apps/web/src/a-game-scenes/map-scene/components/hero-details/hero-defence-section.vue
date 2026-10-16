<template>
  <section class="section" data-testid="hero-vitals-shields">
    <div class="head" data-testid="hero-vitals-shields-head">
      <span class="label" data-testid="hero-vitals-shields-label">{{ labels.vitals.shields }}</span>
      <span class="value" data-testid="hero-vitals-shields-value">
        <b>{{ view.shields.filled }}</b> / {{ view.shields.total }}
      </span>
    </div>
    <hero-shield-nests :filled="view.shields.filled" :total="view.shields.total" />
  </section>
</template>

<script setup lang="ts">
import type { HeroDetailsView } from '@/composables/use-hero-details';
import HeroShieldNests from './hero-shield-nests.vue';
import { useHeroDetailsLabels } from './use-hero-details-labels';

defineProps<{ view: HeroDetailsView }>();
const labels = useHeroDetailsLabels();
</script>

<style scoped>
.section {
  display: grid;
  gap: 10px;
  padding: 14px 18px;
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
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.value {
  color: #cbbfa6;
  font-size: 1rem;
}
.value b {
  color: #e8d7a8;
  font-size: 1.8rem;
  font-weight: 800;
}
</style>
