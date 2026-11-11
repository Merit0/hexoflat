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
      <knowledge-help
        :title="t('shop.title')"
        :text="t('shop.description', { percent: sellRatePercent })"
        :label="t('shop.help')"
        testid="shop-help"
      />
      <board-close-button testid="shop-close" :label="t('shop.close')" @close="closeShopBoard()" />
    </header>
    <div class="ornament" aria-hidden="true"><span></span><i></i><span></span></div>

    <template v-if="definition">
      <shop-trader-banner
        :definition="definition"
        :coins="coins"
        :sell-rate-percent="sellRatePercent"
      />
      <div class="ornament is-aligned" aria-hidden="true"><span></span><i></i><span></span></div>
      <shop-goods-pane :goods="goods" :buyback="buyback" :own="own" :refresh="refresh" />
      <shop-selection-card />
    </template>
    <stash-bag-pane />
    <shop-drag-ghost />
    <shop-toast />
  </section>
</template>

<script setup lang="ts">
import { provide, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import KnowledgeHelp from '../knowledge-help.vue';
import BoardCloseButton from '@/components/gui/board/board-close-button.vue';
import { BOARD_CELL_CONTEXT } from '@/composables/board-cell-context';
import { useInventoryCellSize } from '@/composables/use-inventory-cell-size';
import { closeShopBoard } from '@/composables/use-shop-board';
import { shopBagCellState, shopZoneClass } from '@/composables/shop-drag-state';
import { isTradeCellSelected, selectBagCell } from '@/composables/shop-selection';
import { useShopCard } from '@/composables/use-shop-card';
import { formatKg } from '@/composables/use-stash-board-data';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { beginShopDrag, quickTrade } from '@/composables/use-shop-drag';
import { useShopBoardData } from '@/composables/use-shop-board-data';
import StashBagPane from '../stash/stash-bag-pane.vue';
import ShopDragGhost from './shop-drag-ghost.vue';
import ShopGoodsPane from './shop-goods-pane.vue';
import ShopSelectionCard from './shop-selection-card.vue';
import ShopToast from './shop-toast.vue';
import ShopTraderBanner from './shop-trader-banner.vue';

const { t } = useI18n();
const board = ref<HTMLElement | null>(null);
const { style: cellStyle } = useInventoryCellSize(board);
const { definition, coins, sellRatePercent, goods, buyback, own, refresh, sellPriceOf } =
  useShopBoardData();
const card = useShopCard();
const inventory = useHeroInventoryStore();

function forecastKg(): string | null {
  const view = card.value;
  if (!view || !view.preview.ok) return null;
  const delta = view.unitWeightKg * view.preview.amount;
  const next = view.mode === 'trading' || view.mode === 'listing' ? -delta : delta;
  return formatKg(Math.max(0, inventory.carriedWeightKg + next));
}

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
  select: (location, item) => {
    if (location.container === 'bag') selectBagCell(location.index, item.key);
  },
  isSelected: (location, item) =>
    location.container === 'bag' && isTradeCellSelected('bag', location.index, item.key),
  forecastKg,
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
  font-size: 1.6rem;
  font-weight: 700;
  font-variant: small-caps;
  letter-spacing: 0.05em;
  text-align: center;
  color: #ffe98a;
  text-shadow:
    0 0 12px rgba(255, 233, 138, 0.4),
    0 2px 3px rgba(0, 0, 0, 0.8);
}
.ornament {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
}
.ornament.is-aligned {
  padding: 0 var(--stash-pad);
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
</style>
