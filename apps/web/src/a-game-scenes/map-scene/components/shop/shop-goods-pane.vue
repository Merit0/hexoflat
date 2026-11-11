<template>
  <section
    class="pane"
    data-zone="goods"
    data-testid="shop-goods-pane"
    :aria-label="t('shop.goods')"
  >
    <header class="head">
      <h3>{{ t('shop.goods') }}</h3>
      <shop-refresh-button v-if="refresh" :price="refresh.price" :affordable="refresh.affordable" />
    </header>
    <div class="grid" data-cell-grid data-columns="7">
      <shop-trade-cell
        v-for="cell in goods"
        :key="cell.index"
        :cell="cell"
        kind="buy"
        :testid="`shop-goods-cell-${cell.index}`"
        :price-testid="`shop-price-${cell.index}`"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { ShopTradeCell as TradeCell } from '@/composables/use-shop-board-data';
import type { RefreshPreview } from '@/services/trade/trade-preview';
import ShopRefreshButton from './shop-refresh-button.vue';
import ShopTradeCell from './shop-trade-cell.vue';

defineProps<{ goods: TradeCell[]; refresh: RefreshPreview | null }>();
const { t } = useI18n();
</script>

<style scoped src="./shop-pane.css"></style>
