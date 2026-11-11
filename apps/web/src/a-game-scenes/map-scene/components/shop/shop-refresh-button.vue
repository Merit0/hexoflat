<template>
  <button
    ref="button"
    type="button"
    class="refresh"
    :class="{ 'is-short': !affordable, 'is-confirm': refreshConfirming }"
    :data-affordable="affordable"
    :data-confirm="refreshConfirming"
    :disabled="refreshSending"
    data-testid="shop-refresh"
    @click="onClick"
  >
    <span class="text">{{ t('shop.refresh') }}</span>
    <span class="price" data-testid="shop-refresh-price" :data-price="price">
      <img :src="WILL_ICON" alt="" aria-hidden="true" />
      {{ price }}
    </span>
  </button>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { clickRefresh, refreshConfirming, refreshSending } from '@/composables/use-shop-refresh';

const WILL_ICON = '/board-assets/will-icon-image.png';

const props = defineProps<{ price: number; affordable: boolean; losesBuyback: boolean }>();
const { t } = useI18n();
const button = ref<HTMLElement | null>(null);

function onClick() {
  if (!button.value) return;
  const refresh = { price: props.price, affordable: props.affordable };
  void clickRefresh(refresh, props.losesBuyback, button.value);
}
</script>

<style scoped>
.refresh {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 4px 10px;
  border: 1px solid rgba(255, 220, 150, 0.45);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.45);
  color: rgba(255, 236, 186, 0.95);
  font-family: var(--font-main, serif), serif;
  font-size: 0.78rem;
  font-weight: 700;
  font-variant: small-caps;
  letter-spacing: 0.04em;
  white-space: nowrap;
  transition:
    background 0.12s ease,
    border-color 0.12s ease;
}
.refresh:hover {
  background: rgba(255, 220, 150, 0.12);
  border-color: rgba(255, 220, 150, 0.75);
}
.refresh:focus-visible {
  outline: 2px solid rgba(255, 220, 150, 0.7);
  outline-offset: 1px;
}
.price {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: #ffe98a;
  font-variant: normal;
}
.price img {
  width: 16px;
  height: 16px;
  object-fit: contain;
}
.refresh.is-confirm {
  border-color: #ffe98a;
  background: rgba(255, 220, 150, 0.2);
  box-shadow: 0 0 10px rgba(255, 220, 150, 0.45);
}
.refresh:disabled {
  opacity: 0.6;
}
.refresh.is-short .price {
  color: #ff9d9d;
}
</style>
