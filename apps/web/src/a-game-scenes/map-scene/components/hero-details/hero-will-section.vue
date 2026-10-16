<template>
  <section v-if="view.will" class="will" data-testid="hero-vitals-will">
    <img class="icon" :src="WILL_ICON_URL" alt="" data-testid="hero-will-icon" />
    <div class="body" data-testid="hero-will-body">
      <div class="head" data-testid="hero-will-head">
        <span class="label" data-testid="hero-will-label">{{ labels.vitals.will }}</span>
        <span class="value" data-testid="hero-will-value">
          <b>{{ view.will.current }}</b> / {{ view.will.capacity }}
        </span>
      </div>
      <div class="bar" data-testid="hero-will-bar">
        <div
          class="bar__fill"
          :style="{ width: `${percent}%` }"
          data-testid="hero-will-bar-fill"
        ></div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { WILL_ICON_URL, type HeroDetailsView } from '@/composables/use-hero-details';
import { useHeroDetailsLabels } from './use-hero-details-labels';

const props = defineProps<{ view: HeroDetailsView }>();
const labels = useHeroDetailsLabels();

const percent = computed(() => {
  const will = props.view.will;
  return will ? Math.round((will.current / Math.max(1, will.capacity)) * 100) : 0;
});
</script>

<style scoped>
.will {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 18px;
  border-radius: 14px;
  background: #29333a;
  border: 1px solid #3a474e;
}
.icon {
  flex: none;
  width: 56px;
  height: 56px;
  object-fit: contain;
}
.body {
  flex: 1;
  display: grid;
  gap: 8px;
  min-width: 0;
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
.bar {
  height: 8px;
  border-radius: 999px;
  background: #0f1113;
  overflow: hidden;
}
.bar__fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #5a3fc0, #a35cff);
  transition: width 0.3s ease;
}
</style>
