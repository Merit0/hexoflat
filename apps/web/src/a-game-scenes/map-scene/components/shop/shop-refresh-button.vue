<template>
  <span class="wrap">
    <button
      type="button"
      class="refresh"
      :class="{ 'is-short': !affordable }"
      :disabled="sending"
      :aria-label="t('shop.refresh.aria')"
      :data-affordable="affordable"
      data-testid="shop-refresh"
      @click="onClick"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
        <path d="M8 16H3v5" />
      </svg>
    </button>
    <span
      class="tip"
      :class="{ 'is-short': !affordable }"
      role="tooltip"
      data-testid="shop-refresh-price"
      :data-price="price"
    >
      <span class="cost">
        <img :src="WILL_ICON" alt="" aria-hidden="true" />
        {{ price }}
      </span>
    </span>
  </span>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { refreshSending as sending, refreshShop } from '@/composables/use-shop-refresh';
import type { RefreshPreview } from '@/services/trade/trade-preview';

const WILL_ICON = '/board-assets/will-icon-image.png';

const props = defineProps<{ price: number; affordable: boolean }>();
const { t } = useI18n();

function onClick(): void {
  const refresh: RefreshPreview = { price: props.price, affordable: props.affordable };
  void refreshShop(refresh);
}
</script>

<style scoped>
.wrap {
  position: relative;
  display: inline-flex;
}
.refresh {
  flex: none;
  width: 44px;
  height: 44px;
  padding: 0;
  display: grid;
  place-items: center;
  border: 1px solid #3a4450;
  border-radius: 10px;
  background: #232b34;
  cursor: pointer;
  transition:
    transform 0.06s ease,
    background 0.12s ease,
    border-color 0.12s ease,
    box-shadow 0.12s ease;
}
.refresh:not(:disabled):hover {
  border-color: rgba(227, 194, 122, 0.6);
  background: #2c3641;
}
.refresh:not(:disabled):active {
  background: #151a20;
  box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.6);
  transform: translateY(1px) scale(0.94);
}
.refresh:not(:disabled):active svg {
  transform: rotate(60deg);
}
.refresh svg {
  display: block;
  width: 22px;
  height: 22px;
  fill: none;
  stroke: #e8e2d2;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 0.18s ease;
}
.refresh:focus-visible {
  outline: 2px solid #e3c27a;
  outline-offset: 2px;
}
.refresh:disabled {
  opacity: 0.5;
}
.refresh.is-short svg {
  stroke: rgba(232, 226, 210, 0.55);
}
.tip {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  z-index: 8;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid rgba(227, 194, 122, 0.55);
  border-radius: 6px;
  background: linear-gradient(180deg, #232d38, #10151b);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.6),
    0 8px 18px rgba(0, 0, 0, 0.55);
  white-space: nowrap;
  pointer-events: none;
  visibility: hidden;
  opacity: 0;
  transform: translateY(3px);
  transition:
    opacity 0.12s ease,
    transform 0.12s ease,
    visibility 0.12s;
}
.cost {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #cfe4f8;
  font-family: var(--font-main, serif), serif;
  font-size: 14px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.cost img {
  width: 15px;
  height: 15px;
  object-fit: contain;
}
.tip.is-short .cost {
  color: #ff9d9d;
}
.refresh:hover + .tip,
.refresh:focus-visible + .tip {
  visibility: visible;
  opacity: 1;
  transform: translateY(0);
}
</style>
