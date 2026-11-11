<template>
  <section
    ref="board"
    class="shop-board"
    :style="cellStyle"
    data-testid="shop-board"
    :aria-label="t('shop.title')"
  >
    <header class="top">
      <h2>{{ t('shop.title') }}</h2>
      <board-close-button testid="shop-close" :label="t('shop.close')" @close="closeShopBoard()" />
    </header>
    <div class="ornament" aria-hidden="true"><span></span><i></i><span></span></div>

    <template v-if="definition">
      <shop-trader-banner
        :definition="definition"
        :coins="coins"
        :sell-rate-percent="sellRatePercent"
      />
      <shop-goods-pane :goods="goods" :refresh="refresh" :loses-buyback="hasBuyback" />
      <shop-buyback-row v-if="hasBuyback" :buyback="buyback" />
    </template>
    <stash-bag-pane />
    <shop-drag-ghost />

    <p class="foot" data-testid="shop-hint">{{ hint }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, provide, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BoardCloseButton from '@/components/gui/board/board-close-button.vue';
import { BOARD_CELL_CONTEXT } from '@/composables/board-cell-context';
import { useInventoryCellSize } from '@/composables/use-inventory-cell-size';
import { closeShopBoard } from '@/composables/use-shop-board';
import { shopBagCellState, shopDrag, shopZoneClass } from '@/composables/shop-drag-state';
import { shopHintText } from '@/composables/shop-messages';
import { beginShopDrag, quickTrade } from '@/composables/use-shop-drag';
import { useShopBoardData } from '@/composables/use-shop-board-data';
import StashBagPane from '../stash/stash-bag-pane.vue';
import ShopBuybackRow from './shop-buyback-row.vue';
import ShopDragGhost from './shop-drag-ghost.vue';
import ShopGoodsPane from './shop-goods-pane.vue';
import ShopTraderBanner from './shop-trader-banner.vue';

const { t } = useI18n();
const board = ref<HTMLElement | null>(null);
const { style: cellStyle } = useInventoryCellSize(board);
const { definition, coins, sellRatePercent, goods, buyback, hasBuyback, refresh, sellPriceOf } =
  useShopBoardData();

const hint = computed(() => shopHintText(shopDrag.active, shopDrag.split));

provide(BOARD_CELL_CONTEXT, {
  begin: (event, location, item) => {
    if (location.container === 'bag')
      beginShopDrag(event, { kind: 'bag', index: location.index }, item);
  },
  quick: (location, split) => {
    if (location.container === 'bag')
      void quickTrade({ kind: 'bag', index: location.index }, split);
  },
  stateOf: shopBagCellState,
  zoneClassOf: shopZoneClass,
  priceOf: sellPriceOf,
});
</script>

<style scoped>
.shop-board {
  position: relative;
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 0 0;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.9);
  font-family: var(--font-main, serif), serif;
}
.top {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 54px;
  padding: 0 64px;
}
h2 {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 700;
  font-variant: small-caps;
  letter-spacing: 0.05em;
  text-align: center;
  color: rgba(255, 236, 186, 0.95);
  text-shadow: 0 2px 3px rgba(0, 0, 0, 0.8);
}
.ornament {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
}
.ornament span {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.22), transparent);
}
.ornament i {
  width: 9px;
  height: 9px;
  border: 1px solid rgba(255, 220, 150, 0.55);
  transform: rotate(45deg);
}
.foot {
  margin: 0;
  padding: 2px 10px 6px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.72rem;
  font-weight: 700;
  text-align: center;
}
</style>
