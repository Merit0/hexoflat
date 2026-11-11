<template>
  <section class="banner" :class="zoneClass" data-zone="trader" data-testid="shop-trader-banner">
    <div class="who">
      <h3 data-testid="shop-trader-name">{{ t(definition.title) }}</h3>
      <span class="rate" data-testid="shop-sell-rate">{{
        t('shop.merchant.paysRate', { percent: sellRatePercent })
      }}</span>
    </div>
    <span class="glow" aria-hidden="true"></span>
    <span class="coins" :title="t('shop.coins')" data-testid="shop-coins" :data-coins="coins">
      <img :src="COIN_SRC" alt="" aria-hidden="true" />
      {{ coins }}
    </span>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { shopZoneClass } from '@/composables/shop-drag-state';
import { getPrototype } from '@hexoflat/engine';
import type { TTraderDefinition } from '@hexoflat/engine/content/content-schema';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';

const COIN_SRC = getPrototype(HEXOBJECT_KEYS.COINS).spritePath ?? '';

defineProps<{ definition: TTraderDefinition; coins: number; sellRatePercent: number }>();
const { t } = useI18n();
const zoneClass = computed(() => shopZoneClass('trader'));
</script>

<style scoped>
.banner {
  flex: none;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 14px;
  padding: 10px var(--stash-pad);
  background: rgba(0, 0, 0, 0.35);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1) inset;
}
.banner.zone-ok {
  box-shadow:
    0 0 0 2px rgba(255, 200, 120, 0.5) inset,
    0 0 16px rgba(255, 200, 120, 0.45);
}
.banner.zone-bad {
  box-shadow:
    0 0 0 2px rgba(255, 120, 120, 0.5) inset,
    0 0 16px rgba(255, 80, 80, 0.4);
}
.who {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}
h3 {
  margin: 0;
  font-family: var(--font-main, serif), serif;
  font-size: 26px;
  font-weight: 700;
  line-height: 1.1;
  color: #f0e4c4;
  text-shadow: 0 2px 3px rgba(0, 0, 0, 0.8);
}
.rate {
  padding: 2px 9px;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.75);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}
.glow {
  width: 2px;
  height: 56px;
  background: linear-gradient(180deg, transparent, #f0d48a, transparent);
  box-shadow:
    0 0 8px 1px rgba(240, 212, 138, 0.55),
    0 0 18px 3px rgba(227, 194, 122, 0.22);
}
.coins {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #f0d48a;
  font-family: var(--font-main, serif), serif;
  font-size: 20px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}
.coins img {
  width: 18px;
  height: 18px;
  object-fit: contain;
}
</style>
