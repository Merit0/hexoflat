<template>
  <div class="row" data-testid="shop-tabs-section">
    <shop-tab-bar :buyback-count="buybackCount" :trade-count="tradeCount" />
    <shop-refresh-button
      v-if="refresh"
      class="push"
      :price="refresh.price"
      :affordable="refresh.affordable"
      :enabled="shopTab === 'goods'"
    />
  </div>
</template>

<script setup lang="ts">
import { shopTab } from '@/composables/shop-tab';
import type { RefreshPreview } from '@/services/trade/trade-preview';
import ShopRefreshButton from './shop-refresh-button.vue';
import ShopTabBar from './shop-tab-bar.vue';

defineProps<{ buybackCount: number; tradeCount: number; refresh: RefreshPreview | null }>();
</script>

<style scoped>
.row {
  flex: none;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 0 4px;
}
.push {
  flex: none;
}
</style>
