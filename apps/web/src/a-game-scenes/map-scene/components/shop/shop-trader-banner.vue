<template>
  <section class="banner" :class="zoneClass" data-zone="trader" data-testid="shop-trader-banner">
    <div class="left">
      <img class="coin-icon" :src="COIN_SRC" alt="" aria-hidden="true" />
      <p class="figures" :title="t('shop.coins')" data-testid="shop-coins" :data-coins="coins">
        <span class="figures__label">{{ t('shop.coins') }}</span>
        <span class="figures__value">{{ coins }}</span>
      </p>
    </div>
    <i class="divider" aria-hidden="true"></i>
    <div class="who">
      <h3 data-testid="shop-trader-name">{{ t(definition.title) }}</h3>
      <p class="rate" data-testid="shop-sell-rate">
        {{ t('shop.merchant.paysRate', { percent: sellRatePercent }) }}
      </p>
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
  --diamond: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'><path d='M5 0L10 5L5 10L0 5Z' fill='%23b8864a'/></svg>");
  position: relative;
  isolation: isolate;
  flex: none;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 11px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
  height: 68px;
  margin: 0 var(--stash-pad);
  padding: 4px 12px;
  color: #f1e4cc;
  background: linear-gradient(180deg, #5a6d7e, #202b36);
  clip-path: polygon(
    12px 0,
    calc(100% - 12px) 0,
    100% 12px,
    100% calc(100% - 12px),
    calc(100% - 12px) 100%,
    12px 100%,
    0 calc(100% - 12px),
    0 12px
  );
}
.banner::before {
  content: '';
  position: absolute;
  inset: 2px;
  z-index: -1;
  background: linear-gradient(180deg, #1a2029, #10151c);
  clip-path: polygon(
    10px 0,
    calc(100% - 10px) 0,
    100% 10px,
    100% calc(100% - 10px),
    calc(100% - 10px) 100%,
    10px 100%,
    0 calc(100% - 10px),
    0 10px
  );
}
.banner.zone-ok {
  background: linear-gradient(180deg, #f5c26b, #8a6a2a);
}
.banner.zone-bad {
  background: linear-gradient(180deg, #ff9d9d, #8a2a2a);
}
p {
  margin: 0;
}
.left {
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: stretch;
  gap: 8px;
}
.coin-icon {
  width: 52px;
  height: 52px;
  flex: 0 0 auto;
  object-fit: contain;
  filter: drop-shadow(0 3px 4px rgba(0, 0, 0, 0.6));
}
.figures {
  display: grid;
  gap: 2px;
  white-space: nowrap;
}
.figures__label {
  font-size: 0.9rem;
  font-weight: 600;
  color: #f3e8d2;
}
.figures__value {
  font-size: 1.2rem;
  font-weight: 700;
  color: #f3e8d2;
  font-variant-numeric: tabular-nums;
}
.divider {
  align-self: stretch;
  background:
    var(--diamond) center / 11px 11px no-repeat,
    linear-gradient(180deg, transparent, #b8864a 20%, #b8864a 80%, transparent) center / 1px 100%
      no-repeat;
}
.who {
  min-width: 0;
  display: grid;
  gap: 3px;
  justify-items: center;
  text-align: center;
}
h3 {
  margin: 0;
  max-width: 100%;
  overflow: hidden;
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.1;
  color: #f3e8d2;
  text-wrap: balance;
}
.rate {
  font-size: 0.8rem;
  line-height: 1.15;
  font-weight: 600;
  color: rgba(243, 232, 210, 0.82);
}
</style>
