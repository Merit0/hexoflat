<template>
  <section
    class="pane is-buyback"
    data-zone="buyback"
    data-testid="shop-buyback-pane"
    :aria-label="t('shop.buyback')"
  >
    <header class="head">
      <h3>{{ t('shop.buyback') }}</h3>
      <span class="note">{{ t('shop.buybackHint') }}</span>
    </header>
    <div class="grid" data-cell-grid data-columns="7">
      <shop-trade-cell
        v-for="cell in buyback"
        :key="cell.index"
        :cell="cell"
        kind="buyback"
        :testid="`shop-buyback-cell-${cell.index}`"
        :price-testid="`shop-buyback-price-${cell.index}`"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { ShopTradeCell as TradeCell } from '@/composables/use-shop-board-data';
import ShopTradeCell from './shop-trade-cell.vue';

defineProps<{ buyback: TradeCell[] }>();
const { t } = useI18n();
</script>

<style scoped src="./shop-pane.css"></style>
