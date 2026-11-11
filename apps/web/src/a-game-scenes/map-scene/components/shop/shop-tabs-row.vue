<template>
  <div class="row" role="tablist">
    <button
      type="button"
      role="tab"
      class="tab"
      :class="{ 'is-active': shopTab === 'goods' }"
      :aria-selected="shopTab === 'goods'"
      data-testid="shop-tab-goods"
      @click="setTab('goods')"
    >
      {{ t('shop.tab.goods') }}
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
      {{ t('shop.tab.buyback') }}
      <span v-if="buybackCount > 0" class="badge" data-testid="shop-tab-buyback-badge">{{
        buybackCount
      }}</span>
    </button>
    <shop-refresh-button
      v-if="refresh"
      class="push"
      :price="refresh.price"
      :affordable="refresh.affordable"
    />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { TTradeList } from '@hexoflat/engine/trade/trade-types';
import { clearShopSelection } from '@/composables/shop-selection';
import { shopTab } from '@/composables/shop-tab';
import type { RefreshPreview } from '@/services/trade/trade-preview';
import ShopRefreshButton from './shop-refresh-button.vue';

defineProps<{ buybackCount: number; refresh: RefreshPreview | null }>();
const { t } = useI18n();

function setTab(tab: TTradeList): void {
  if (shopTab.value === tab) return;
  shopTab.value = tab;
  clearShopSelection();
}
</script>

<style scoped>
.row {
  flex: none;
  box-sizing: border-box;
  height: 56px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 var(--stash-pad);
}
.push {
  margin-left: auto;
  margin-right: calc(10px - 2 * var(--stash-pad, 0px));
}
.tab {
  position: relative;
  height: 44px;
  padding: 0 16px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: rgba(255, 255, 255, 0.65);
  font-family: var(--font-main, serif), serif;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}
.tab.is-active {
  border-color: #e3c27a;
  background: rgba(227, 194, 122, 0.14);
  color: #f0e4c4;
}
.tab:focus-visible {
  outline: 2px solid #e3c27a;
  outline-offset: 2px;
}
.badge {
  position: absolute;
  top: -6px;
  right: -6px;
  z-index: 1;
  min-width: 18px;
  height: 18px;
  box-sizing: border-box;
  display: grid;
  place-items: center;
  padding: 0 4px;
  border: 1px solid #c9b5f5;
  border-radius: 10px;
  background: #4b3b8f;
  box-shadow:
    0 0 8px rgba(201, 181, 245, 0.45),
    0 2px 6px rgba(0, 0, 0, 0.55);
  color: #eaf2ff;
  font-family:
    system-ui,
    -apple-system,
    'Segoe UI',
    Roboto,
    sans-serif;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
</style>
