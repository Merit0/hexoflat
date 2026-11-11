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
      :tabindex="usable ? 0 : -1"
      :role="usable ? 'button' : undefined"
      :aria-label="label"
      :data-selected="selected"
      :data-sold="cell.sold || undefined"
      @pointerdown.prevent="onPointerDown"
      @click="onSelect"
      @dblclick.prevent="onQuickTrade"
      @contextmenu.prevent="onQuickTrade"
      @keydown.enter.prevent="onQuickTrade"
      @keydown="onNavigate"
    >
      <stash-item-token
        v-if="cell.item && !lifted"
        :item="cell.item"
        standalone
        :rotation-deg="tilt"
        :price="tooltipPrice"
      />
      <span v-if="showsCounter(cell.item) && !lifted" class="amount">{{ cell.item?.amount }}</span>
      <span v-if="cell.sold" class="sold-label" data-testid="shop-sold-label">{{
        i18n.t('shop.soldOut')
      }}</span>
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
import { isTradeCellSelected, selectTradeCell } from '@/composables/shop-selection';
import { shopTiltOf } from '@/composables/shop-tilt';
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
const tilt = computed(() => shopTiltOf(list.value, props.cell.index, props.cell.item?.key ?? ''));
const lifted = computed(() => isTradeCellLifted(list.value, props.cell.index));
const usable = computed(() => !!props.cell.item && !props.cell.sold);
const selected = computed(() =>
  isTradeCellSelected(
    list.value,
    props.cell.index,
    usable.value ? (props.cell.item?.key ?? null) : null,
  ),
);

const classes = computed(() => ({
  'cursor-grab': usable.value,
  'is-lifted': lifted.value,
  'is-selected': selected.value,
  'is-sold': props.cell.sold,
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
  if (props.cell.item && usable.value) beginShopDrag(event, source.value, props.cell.item);
}

function onSelect() {
  if (props.cell.item && usable.value) {
    selectTradeCell(list.value, props.cell.index, props.cell.item.key);
  }
}

function onQuickTrade(event: MouseEvent | KeyboardEvent) {
  if (usable.value) void quickTrade(source.value, event.shiftKey);
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
.trade-slot .cell.is-selected {
  border: 1px solid #f5c26b;
  background: rgba(122, 141, 160, 0.34);
  box-shadow:
    0 0 0 2px rgba(245, 194, 107, 0.55) inset,
    0 0 12px rgba(122, 141, 160, 0.55);
}
.trade-slot .cell.is-sold {
  cursor: default;
}
.trade-slot .cell.is-sold > :not(.sold-label) {
  opacity: 0.3;
  pointer-events: none;
}
.sold-label {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #ff9d9d;
  font-size: calc(0.72rem * var(--shop-tag-scale, 1) * 0.75);
  font-weight: 800;
  letter-spacing: 0.06em;
  white-space: nowrap;
  text-transform: uppercase;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.95);
  pointer-events: none;
}
.trade-slot .amount {
  font-size: calc(11px * var(--shop-tag-scale, 1));
}
</style>
