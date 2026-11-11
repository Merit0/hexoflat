<template>
  <div class="bar" role="tablist" :data-active="shopTab" data-testid="shop-tab-bar">
    <span class="thumb" aria-hidden="true"></span>
    <button
      type="button"
      role="tab"
      class="tab"
      :class="{ 'is-active': shopTab === 'goods' }"
      :aria-selected="shopTab === 'goods'"
      data-testid="shop-tab-goods"
      @click="setTab('goods')"
    >
      <svg class="glyph" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 8h14l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H7.7a1.5 1.5 0 0 1-1.5-1.3L5 8Z" />
        <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
      </svg>
      <span class="label">{{ t('shop.tab.goods') }}</span>
    </button>
    <button
      type="button"
      role="tab"
      class="tab"
      :class="{ 'is-active': shopTab === 'buyback' }"
      :aria-selected="shopTab === 'buyback'"
      data-testid="shop-tab-buyback"
      :data-count="buybackCount"
      @click="setTab('buyback')"
    >
      <svg class="glyph" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5" />
        <path d="M12 8v4l3 2" />
      </svg>
      <span class="label">{{ t('shop.tab.buyback') }}</span>
      <span v-if="buybackCount > 0" class="badge" data-testid="shop-tab-buyback-badge">{{
        buybackCount
      }}</span>
    </button>
    <button
      type="button"
      role="tab"
      class="tab"
      :class="{ 'is-active': shopTab === 'trade' }"
      :aria-selected="shopTab === 'trade'"
      data-testid="shop-tab-trade"
      :data-count="tradeCount"
      @click="setTab('trade')"
    >
      <svg class="glyph" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9h13l-3-3" />
        <path d="M20 15H7l3 3" />
      </svg>
      <span class="label">{{ t('shop.tab.trade') }}</span>
      <span v-if="tradeCount > 0" class="badge" data-testid="shop-tab-trade-badge">{{
        tradeCount
      }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { clearShopSelection } from '@/composables/shop-selection';
import { shopTab, type ShopTabKey } from '@/composables/shop-tab';

defineProps<{ buybackCount: number; tradeCount: number }>();
const { t } = useI18n();

function setTab(tab: ShopTabKey): void {
  if (shopTab.value === tab) return;
  shopTab.value = tab;
  clearShopSelection();
}
</script>

<style scoped>
.bar {
  --gap: 4px;
  position: relative;
  isolation: isolate;
  flex: 1 1 auto;
  min-width: 0;
  max-width: 520px;
  box-sizing: border-box;
  height: 52px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--gap);
  padding: var(--gap);
  border: 2px solid transparent;
  border-radius: 13px;
  background:
    linear-gradient(180deg, #1a2029, #10151c) padding-box,
    linear-gradient(180deg, #5a6d7e, #202b36) border-box;
  box-shadow:
    inset 0 3px 8px rgba(0, 0, 0, 0.65),
    0 0 0 1px rgba(0, 0, 0, 0.6);
}
.thumb {
  position: absolute;
  z-index: 0;
  top: var(--gap);
  bottom: var(--gap);
  left: var(--gap);
  width: calc((100% - 4 * var(--gap)) / 3);
  border-radius: 9px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0) 50%),
    linear-gradient(180deg, #dbe9f6, #8fa9c0);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.8),
    inset 0 -2px 0 rgba(32, 43, 54, 0.45),
    0 3px 8px rgba(0, 0, 0, 0.55),
    0 0 14px rgba(207, 228, 248, 0.35);
  transition: transform 0.22s cubic-bezier(0.3, 0.9, 0.3, 1);
}
.bar[data-active='buyback'] .thumb {
  transform: translateX(calc(100% + var(--gap)));
}
.bar[data-active='trade'] .thumb {
  transform: translateX(calc(200% + 2 * var(--gap)));
}
.tab {
  position: relative;
  z-index: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0;
  border: 0;
  border-radius: 9px;
  background: transparent;
  box-shadow: none;
  color: rgba(243, 232, 210, 0.62);
  font-family: var(--font-main, serif), serif;
  font-size: 14px;
  font-weight: 900;
  letter-spacing: 0.04em;
  -webkit-text-stroke: 0.4px currentColor;
  text-transform: uppercase;
  white-space: nowrap;
  cursor: pointer;
  transition:
    color 0.18s ease,
    background 0.18s ease;
}
.tab:not(.is-active):hover {
  background: rgba(90, 109, 126, 0.28);
  color: #f3e8d2;
}
.tab:not(.is-active):active {
  background: rgba(90, 109, 126, 0.42);
}
.tab.is-active,
.tab.is-active:hover,
.tab.is-active:focus-visible {
  color: #0f1620;
  border-color: transparent;
  box-shadow: none;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.5);
}
.tab.is-active .label,
.tab.is-active .glyph {
  color: #0f1620;
}
.tab:focus-visible {
  outline: 2px solid #e6f1fb;
  outline-offset: -2px;
}
.glyph {
  flex: none;
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.label {
  overflow: hidden;
  text-overflow: ellipsis;
}
.badge {
  position: absolute;
  top: -9px;
  right: -3px;
  z-index: 2;
  min-width: 20px;
  height: 20px;
  box-sizing: border-box;
  display: grid;
  place-items: center;
  padding: 0 5px;
  border: 1px solid #c9b5f5;
  border-radius: 10px;
  background: linear-gradient(180deg, #6652b8, #43347f);
  box-shadow:
    0 0 9px rgba(201, 181, 245, 0.5),
    0 2px 6px rgba(0, 0, 0, 0.6);
  color: #f2f6ff;
  font-family:
    system-ui,
    -apple-system,
    'Segoe UI',
    Roboto,
    sans-serif;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1;
  text-shadow: none;
  font-variant-numeric: tabular-nums;
}
@media (prefers-reduced-motion: reduce) {
  .thumb,
  .tab {
    transition: none;
  }
}
</style>
