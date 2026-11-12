<template>
  <div
    class="price"
    :class="{ 'is-short': !price.affordable }"
    :data-kind="price.kind"
    data-testid="item-tooltip-price"
  >
    <span class="label">{{ label }}</span>
    <span class="value">
      <img :src="COIN_SRC" alt="" aria-hidden="true" />
      <span data-testid="item-tooltip-price-value">{{ price.coins }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { getPrototype } from '@hexoflat/engine';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import type { TooltipPrice } from '@/composables/use-item-tooltip';

const COIN_SRC = getPrototype(HEXOBJECT_KEYS.COINS).spritePath ?? '';

const props = defineProps<{ price: TooltipPrice }>();
const { t } = useI18n();

const label = computed(() => {
  if (props.price.kind === 'sell') return t('shop.price.sell');
  if (props.price.kind === 'buyback') return t('shop.price.buyback');
  return t('shop.price.buy');
});
</script>

<style scoped>
.price {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 360px;
  box-sizing: border-box;
  margin-top: 6px;
  padding: 8px 18px;
  border: 1px solid #2e281f;
  border-radius: 6px;
  background: #0e0c09;
  color: #e8e0cf;
  font-family: 'Alegreya Sans', var(--font-main, serif), sans-serif;
  font-size: 0.9rem;
  filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.55));
}
.label {
  color: #bfa77c;
  font-variant: small-caps;
  letter-spacing: 0.05em;
}
.value {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 800;
  color: #ffe98a;
}
.value img {
  width: 20px;
  height: 20px;
  object-fit: contain;
}
.is-short .value {
  color: #ff9d9d;
}
</style>
