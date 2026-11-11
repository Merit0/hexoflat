<template>
  <section class="banner" :class="zoneClass" data-zone="trader" data-testid="shop-trader-banner">
    <img class="portrait" :src="definition.portraitPath" alt="" aria-hidden="true" />
    <div class="who">
      <h3 data-testid="shop-trader-name">{{ t(definition.title) }}</h3>
      <p>{{ t(definition.line) }}</p>
    </div>
    <div class="purse">
      <span class="coins" :title="t('shop.coins')" data-testid="shop-coins" :data-coins="coins">
        <img :src="COIN_SRC" alt="" aria-hidden="true" />
        {{ coins }}
      </span>
      <span class="rate" data-testid="shop-sell-rate">{{
        t('shop.sellRate', { percent: sellRatePercent })
      }}</span>
    </div>
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
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 8px var(--stash-pad);
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
.portrait {
  width: 56px;
  height: 56px;
  object-fit: contain;
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.7));
  pointer-events: none;
}
.who {
  min-width: 0;
}
h3 {
  margin: 0;
  overflow: hidden;
  font-family: var(--font-main, serif), serif;
  font-size: 1rem;
  font-weight: 700;
  font-variant: small-caps;
  letter-spacing: 0.05em;
  color: #ffe98a;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow: 0 2px 3px rgba(0, 0, 0, 0.8);
}
p {
  margin: 2px 0 0;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.78rem;
  font-style: italic;
}
.purse {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}
.coins {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #ffe98a;
  font-size: 1rem;
  font-weight: 800;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}
.coins img {
  width: 22px;
  height: 22px;
  object-fit: contain;
}
.rate {
  color: rgba(255, 236, 186, 0.8);
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
}
</style>
