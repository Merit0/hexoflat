<template>
  <header class="header" data-testid="hero-details-header">
    <div
      class="portrait"
      :style="{ backgroundImage: `url('${HERO_PORTRAIT_URL}')` }"
      data-testid="hero-details-portrait"
    ></div>
    <div class="meta" data-testid="hero-details-meta">
      <div class="name" data-testid="topbar-hero-name">{{ view.name }}</div>
      <div class="rank" data-testid="topbar-scout-chip">
        {{ view.rank.roman }} · {{ view.rank.title }}
      </div>
      <div class="chips" data-testid="hero-details-chips">
        <span class="chip" data-testid="topbar-map-chip">{{ view.locationTitle }}</span>
      </div>
    </div>
    <template v-if="view.will">
      <span class="divider" data-testid="hero-details-will-divider"></span>
      <div class="will" data-testid="hero-vitals-will">
        <img class="will__icon" :src="WILL_ICON_URL" alt="" data-testid="hero-will-icon" />
        <div class="will__label" data-testid="hero-will-label">{{ labels.vitals.will }}</div>
        <div class="will__value" data-testid="hero-will-value">
          <b>{{ view.will.current }}</b> / {{ view.will.capacity }}
        </div>
      </div>
    </template>
  </header>
</template>

<script setup lang="ts">
import {
  HERO_PORTRAIT_URL,
  WILL_ICON_URL,
  type HeroDetailsView,
} from '@/composables/use-hero-details';
import { useHeroDetailsLabels } from './use-hero-details-labels';

defineProps<{ view: HeroDetailsView }>();
const labels = useHeroDetailsLabels();
</script>

<style scoped>
.header {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 10px 20px;
  border-radius: 18px;
  background: #0f1113;
  border: 1px solid #3a474e;
}
.portrait {
  flex: none;
  width: 96px;
  height: 110px;
  background-position: center;
  background-repeat: no-repeat;
  background-size: contain;
  filter: drop-shadow(0 8px 14px rgba(0, 0, 0, 0.5));
}
.meta {
  flex: 1;
  display: grid;
  gap: 6px;
  min-width: 0;
}
.name {
  color: #e8d7a8;
  font-family: 'Alegreya SC', serif;
  font-size: 2rem;
  font-weight: 700;
  line-height: 1;
}
.rank {
  color: #cbbfa6;
  font-size: 1rem;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  padding: 4px 16px;
  border-radius: 999px;
  background: #23292c;
  border: 1px solid #3a474e;
  color: #ede3d2;
  font-size: 0.95rem;
}
.divider {
  align-self: stretch;
  margin: 8px 0;
  width: 1px;
  background: #3a474e;
}
.will {
  flex: none;
  display: grid;
  justify-items: center;
  gap: 2px;
}
.will__icon {
  width: 48px;
  height: 48px;
  object-fit: contain;
}
.will__label {
  color: #cbbfa6;
  font-family: 'Alegreya SC', serif;
  font-size: 0.9rem;
  letter-spacing: 0.04em;
}
.will__value {
  color: #cbbfa6;
  font-size: 0.9rem;
}
.will__value b {
  color: #e8d7a8;
  font-size: 1.5rem;
  font-weight: 800;
}
</style>
