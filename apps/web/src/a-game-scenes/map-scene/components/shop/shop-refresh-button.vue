<template>
  <button
    type="button"
    class="refresh"
    :class="{ 'is-short': !affordable }"
    :data-affordable="affordable"
    data-testid="shop-refresh"
  >
    <span class="text">{{ t('shop.refresh') }}</span>
    <span class="price" data-testid="shop-refresh-price" :data-price="price">
      <img :src="WILL_ICON" alt="" aria-hidden="true" />
      {{ price }}
    </span>
  </button>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const WILL_ICON = '/board-assets/will-icon-image.png';

defineProps<{ price: number; affordable: boolean }>();
const { t } = useI18n();
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
.refresh.is-short .price {
  color: #ff9d9d;
}
</style>
