<template>
  <div class="trade-slot">
    <div
      class="cell"
      :class="{ 'cursor-grab': !!cell.item }"
      :data-testid="testid"
      :data-item-key="cell.item?.key"
      :data-item-amount="cell.item?.amount"
      :data-rarity="rarity"
      :data-price="cell.price ?? undefined"
      :tabindex="cell.item ? 0 : -1"
      :role="cell.item ? 'button' : undefined"
      :aria-label="label"
    >
      <stash-item-token v-if="cell.item" :item="cell.item" standalone :price="tooltipPrice" />
      <span v-if="showsCounter(cell.item)" class="amount">{{ cell.item?.amount }}</span>
    </div>
    <shop-price-tag
      v-if="cell.price !== null"
      :price="cell.price"
      :affordable="cell.affordable"
      :testid="priceTestid"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { getMeta, getPrototype } from '@hexoflat/engine';
import { getObjectRarityTone } from '@/render/rarity';
import { showsCounter } from '@/composables/item-counter';
import type { TooltipPrice } from '@/composables/use-item-tooltip';
import type { ShopTradeCell } from '@/composables/use-shop-board-data';
import StashItemToken from '../stash/stash-item-token.vue';
import ShopPriceTag from './shop-price-tag.vue';

const props = defineProps<{
  cell: ShopTradeCell;
  kind: 'buy' | 'buyback';
  testid: string;
  priceTestid: string;
}>();

const i18n = useI18n();

const rarity = computed(() =>
  props.cell.item
    ? (getObjectRarityTone(getPrototype(props.cell.item.key)) ?? undefined)
    : undefined,
);

const label = computed(() => {
  if (!props.cell.item) return undefined;
  const title = getMeta(props.cell.item.key).title;
  return i18n.te(title) ? i18n.t(title) : title;
});

function tooltipPrice(): TooltipPrice | null {
  const { price, affordable } = props.cell;
  return price === null ? null : { kind: props.kind, coins: price, affordable };
}
</script>

<style scoped src="../../../../components/gui/board/board-cell.css"></style>

<style scoped>
.trade-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-width: 0;
}
.trade-slot .cell {
  width: 100%;
}
</style>
