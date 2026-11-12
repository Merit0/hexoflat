<template>
  <section
    class="pane"
    :class="zoneClass"
    :data-zone="shopTab"
    :data-testid="`shop-${shopTab}-pane`"
    :aria-label="t(`shop.tab.${shopTab}`)"
  >
    <shop-tabs-row :buyback-count="buybackCount" :trade-count="tradeCount" :refresh="refresh" />
    <div v-if="shopTab === 'trade'" class="grid is-goods" data-cell-grid data-columns="4">
      <shop-trade-cell
        v-for="cell in own"
        :key="`own-${cell.index}`"
        :cell="cell"
        kind="own"
        :testid="`shop-own-cell-${cell.index}`"
        :price-testid="`shop-own-price-${cell.index}`"
      />
    </div>
    <div v-else-if="shopTab === 'goods'" class="grid is-goods" data-cell-grid data-columns="4">
      <shop-trade-cell
        v-for="cell in goods"
        :key="`goods-${cell.index}`"
        :cell="cell"
        kind="buy"
        :testid="`shop-goods-cell-${cell.index}`"
        :price-testid="`shop-price-${cell.index}`"
      />
    </div>
    <template v-else>
      <div class="grid" data-cell-grid data-columns="7">
        <shop-trade-cell
          v-for="cell in buyback"
          :key="`buyback-${cell.index}`"
          :cell="cell"
          kind="buyback"
          :testid="`shop-buyback-cell-${cell.index}`"
          :price-testid="`shop-buyback-price-${cell.index}`"
        />
      </div>
      <p v-if="buybackCount === 0" class="empty" data-testid="shop-buyback-empty">
        <b>{{ t('shop.buyback.emptyTitle') }}</b>
        {{ t('shop.buyback.emptyHint') }}
      </p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { shopZoneClass } from '@/composables/shop-drag-state';
import { shopTab } from '@/composables/shop-tab';
import type { ShopTradeCell as TradeCell } from '@/composables/use-shop-board-data';
import type { RefreshPreview } from '@/services/trade/trade-preview';
import ShopTabsRow from './shop-tabs-row.vue';
import ShopTradeCell from './shop-trade-cell.vue';

const props = defineProps<{
  goods: TradeCell[];
  buyback: TradeCell[];
  own: TradeCell[];
  refresh: RefreshPreview | null;
}>();
const { t } = useI18n();
const zoneClass = computed(() => (shopTab.value === 'trade' ? '' : shopZoneClass(shopTab.value)));
const tradeCount = computed(() => props.own.filter((cell) => cell.item !== null).length);
const buybackCount = computed(() => props.buyback.filter((cell) => cell.item !== null).length);
</script>

<style scoped src="./shop-pane.css"></style>
<style scoped>
.empty {
  margin: 0;
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  text-align: center;
}
.empty b {
  display: block;
  color: rgba(255, 236, 186, 0.95);
  font-size: 14px;
}
</style>
