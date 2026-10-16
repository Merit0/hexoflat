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
  </header>
</template>

<script setup lang="ts">
import { HERO_PORTRAIT_URL, type HeroDetailsView } from '@/composables/use-hero-details';

defineProps<{ view: HeroDetailsView }>();
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
</style>
