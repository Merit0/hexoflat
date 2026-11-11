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
  --face: linear-gradient(180deg, #3d4d5c, #2a3744);
  --edge: linear-gradient(180deg, #7a8da0, #1b2630 60%, #46586a);
  position: relative;
  isolation: isolate;
  flex: none;
  width: 50px;
  height: 50px;
  padding: 0;
  display: grid;
  place-items: center;
  border: 0;
  color: #f3e8d2;
  cursor: pointer;
  background: var(--edge);
  clip-path: polygon(
    14px 0,
    calc(100% - 14px) 0,
    100% 14px,
    100% calc(100% - 14px),
    calc(100% - 14px) 100%,
    14px 100%,
    0 calc(100% - 14px),
    0 14px
  );
  transition: transform 0.06s ease;
}
.refresh::before {
  content: '';
  position: absolute;
  inset: 2px;
  z-index: -1;
  background: var(--face);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14);
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
.refresh svg {
  display: block;
  width: 24px;
  height: 24px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 0.18s ease;
}
.refresh:not(:disabled):hover {
  --face: linear-gradient(180deg, #4a5d6e, #34444f);
}
.refresh:not(:disabled):active {
  --face: linear-gradient(180deg, #1f2a34, #2a3744);
  transform: translateY(1px) scale(0.95);
}
.refresh:not(:disabled):active svg {
  transform: rotate(60deg);
}
.refresh:focus-visible {
  outline: 3px solid #f5c26b;
  outline-offset: 3px;
}
.refresh:disabled {
  opacity: 0.5;
}
.refresh.is-short svg {
  opacity: 0.55;
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
