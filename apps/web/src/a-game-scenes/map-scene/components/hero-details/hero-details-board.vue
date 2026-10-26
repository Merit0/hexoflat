<template>
  <section ref="wrapperRef" class="hero-details" data-testid="hero-tab-content">
    <div
      ref="contentRef"
      class="hero-details__content"
      :style="{ transform: `translate(${offsetX}px, 0) scale(${scale})` }"
    >
      <hero-details-header :view="view" />
      <hero-vital-section
        kind="heart"
        :label="labels.vitals.hearts"
        :current="view.hearts.current"
        :max="view.hearts.max"
        :slot-count="view.hearts.count"
        test-prefix="hero-vitals-hearts"
        data-testid="topbar-hp-bar"
      />
      <hero-vital-section
        kind="shield"
        :label="labels.vitals.shields"
        :current="view.shields.filled"
        :max="view.shields.total"
        :slot-count="view.shields.total"
        test-prefix="hero-vitals-shields"
        data-testid="hero-vitals-shields"
      />
      <hero-stat-grid :view="view" />
      <hero-details-tabs v-model="tab" />

      <hero-hands-section v-if="tab === 'state'" :view="view" @unequip="unequipHand" />

      <div v-else class="cards" data-testid="hero-details-skills">
        <hero-details-card class="card" data-testid="hero-path-scout">
          <div class="card__title" data-testid="hero-path-scout-title">
            {{ t('heroDetails.path.scout') }} {{ view.scout.roman }} · {{ view.scout.title }}
          </div>
          <div class="bar" data-testid="hero-path-scout-bar">
            <div
              class="bar__fill"
              :style="{ width: `${view.scout.percent}%` }"
              data-testid="hero-path-scout-bar-fill"
            ></div>
          </div>
          <div class="card__note" data-testid="hero-path-scout-note">
            <span data-testid="hero-path-steps">
              {{ t('heroDetails.path.steps') }}: <b>{{ view.scout.steps }}</b>
            </span>
            ·
            {{
              view.scout.nextAt === null
                ? t('heroDetails.path.maxRank')
                : t('heroDetails.path.nextRank', { steps: view.scout.nextAt })
            }}
          </div>
        </hero-details-card>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useFitToWidth } from '@/composables/use-fit-to-width';
import { useI18n } from 'vue-i18n';
import { useHeroDetails, type HeroDetailsTab } from '@/composables/use-hero-details';
import HeroDetailsHeader from './hero-details-header.vue';
import HeroVitalSection from './hero-vital-section.vue';
import { useHeroDetailsLabels } from './use-hero-details-labels';
import HeroStatGrid from './hero-stat-grid.vue';
import HeroDetailsTabs from './hero-details-tabs.vue';
import HeroDetailsCard from './hero-details-card.vue';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import HeroHandsSection from './hero-hands-section.vue';

const { t } = useI18n();
const view = useHeroDetails();
const tab = ref<HeroDetailsTab>('state');
const labels = useHeroDetailsLabels();
const inventory = useHeroInventoryStore();

function unequipHand(hand: 'right' | 'left') {
  inventory.unequipHand(hand === 'right' ? 'weapon' : 'shield');
}
const { wrapperRef, contentRef, scale, offsetX } = useFitToWidth();
</script>

<style scoped>
.hero-details {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  color: #ede3d2;
  font-family: 'Alegreya Sans', sans-serif;
  background: #15191b;
}
.hero-details__content {
  position: absolute;
  top: 0;
  left: 0;
  box-sizing: border-box;
  width: 100%;
  display: grid;
  gap: 14px;
  padding: 14px;
  transform-origin: top left;
}
.cards {
  display: grid;
  gap: 10px;
}
.cards .card {
  gap: 10px;
}
.card__title {
  color: #e8d7a8;
  font-family: 'Alegreya SC', serif;
  font-size: 1.2rem;
  font-weight: 700;
}
.card__note {
  color: #a39886;
  font-size: 0.9rem;
}
.bar {
  height: 10px;
  border-radius: 999px;
  background: #23292c;
  overflow: hidden;
}
.bar__fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #5a0f2c, #8c1c47);
  transition: width 0.3s ease;
}
</style>
