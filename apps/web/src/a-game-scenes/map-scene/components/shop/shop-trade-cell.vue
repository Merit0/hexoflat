<template>
  <div class="trade-slot">
    <div
      class="cell"
      :class="classes"
      :data-testid="testid"
      data-trade-cell
      :data-trade-list="list"
      :data-trade-index="cell.index"
      :data-item-key="cell.item?.key"
      :data-item-amount="cell.item?.amount"
      :data-rarity="rarity"
      :data-price="cell.price ?? undefined"
      :tabindex="cell.item ? 0 : -1"
      :role="cell.item ? 'button' : undefined"
      :aria-label="label"
      @pointerdown.prevent="onPointerDown"
      @dblclick.prevent="onQuickTrade"
      @contextmenu.prevent="onQuickTrade"
      @keydown.enter.prevent="onQuickTrade"
      @keydown="onNavigate"
    >
      <stash-item-token
        v-if="cell.item && !lifted"
        :item="cell.item"
        standalone
        :price="tooltipPrice"
      />
      <span v-if="showsCounter(cell.item) && !lifted" class="amount">{{ cell.item?.amount }}</span>
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
import type { TTradeList } from '@hexoflat/engine/trade/trade-types';
import { getObjectRarityTone } from '@/render/rarity';
import { showsCounter } from '@/composables/item-counter';
import type { TooltipPrice } from '@/composables/use-item-tooltip';
import { stashFx } from '@/composables/stash-drag-state';
import { isTradeCellLifted, type ShopDragSource } from '@/composables/shop-drag-state';
import { moveGridFocus } from '@/composables/stash-grid-nav';
import { beginShopDrag, quickTrade } from '@/composables/use-shop-drag';
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
const list = computed<TTradeList>(() => (props.kind === 'buy' ? 'goods' : 'buyback'));
const key = computed(() => `${list.value}:${props.cell.index}`);
const source = computed<ShopDragSource>(() => ({
  kind: 'trade',
  list: list.value,
  index: props.cell.index,
}));
const lifted = computed(() => isTradeCellLifted(list.value, props.cell.index));

const classes = computed(() => ({
  'cursor-grab': !!props.cell.item,
  'is-lifted': lifted.value,
  'is-landed': stashFx.landed === key.value,
  'is-shake': stashFx.shake === key.value,
}));

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

function onPointerDown(event: PointerEvent) {
  if (props.cell.item) beginShopDrag(event, source.value, props.cell.item);
}

function onQuickTrade(event: MouseEvent | KeyboardEvent) {
  if (props.cell.item) void quickTrade(source.value, event.shiftKey);
}

function onNavigate(event: KeyboardEvent) {
  moveGridFocus(event, '[data-trade-cell]');
}

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
