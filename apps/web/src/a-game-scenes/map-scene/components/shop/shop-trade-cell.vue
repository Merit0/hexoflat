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
      :data-wasted="cell.wasted || undefined"
      :data-own-empty="(own && !cell.item) || undefined"
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
    </div>
    <span
      v-if="showsCounter(cell.item) && !lifted && !cell.sold && !cell.wasted"
      class="amount"
      data-testid="shop-slot-amount"
      >{{ cell.item?.amount }}</span
    >
    <span
      v-if="cell.discountPercent !== null && !cell.sold && !cell.wasted"
      class="badge"
      :data-testid="`shop-offer-badge-${cell.index}`"
      >{{ i18n.t('shop.badge.percent', { p: cell.discountPercent }) }}</span
    >
    <div v-if="cell.sold || cell.wasted || cell.price !== null" class="price-section">
      <span v-if="cell.sold" class="sold-label" data-testid="shop-sold-label">{{
        i18n.t('shop.status.soldOut')
      }}</span>
      <span v-else-if="cell.wasted" class="sold-label" data-testid="shop-wasted-label">{{
        i18n.t('shop.status.wasted')
      }}</span>
      <shop-price-tag
        v-else-if="cell.price !== null"
        :price="cell.price"
        :affordable="cell.affordable"
        :testid="priceTestid"
      />
    </div>
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
import { isTradeCellSelected, selectOwnCell, selectTradeCell } from '@/composables/shop-selection';
import { shopTiltOf } from '@/composables/shop-tilt';
import { moveGridFocus } from '@/composables/stash-grid-nav';
import { beginShopDrag, quickTrade } from '@/composables/use-shop-drag';
import type { ShopTradeCell } from '@/composables/use-shop-board-data';
import StashItemToken from '../stash/stash-item-token.vue';
import ShopPriceTag from './shop-price-tag.vue';

const props = defineProps<{
  cell: ShopTradeCell;
  kind: 'buy' | 'buyback' | 'own';
  testid: string;
  priceTestid: string;
}>();

const i18n = useI18n();
const own = computed(() => props.kind === 'own');
const list = computed<TTradeList>(() => (props.kind === 'buyback' ? 'buyback' : 'goods'));
const key = computed(() => `${props.kind}:${props.cell.index}`);
const source = computed<ShopDragSource>(() => ({
  kind: 'trade',
  list: list.value,
  index: props.cell.index,
}));
const tilt = computed(() => shopTiltOf(list.value, props.cell.index, props.cell.item?.key ?? ''));
const lifted = computed(() => !own.value && isTradeCellLifted(list.value, props.cell.index));
const usable = computed(() => !!props.cell.item && !props.cell.sold && !props.cell.wasted);
const selected = computed(() =>
  isTradeCellSelected(
    own.value ? 'own' : list.value,
    props.cell.index,
    usable.value ? (props.cell.item?.key ?? null) : null,
  ),
);

const classes = computed(() => ({
  'cursor-grab': usable.value,
  'is-lifted': lifted.value,
  'is-selected': selected.value,
  'is-sold': props.cell.sold || props.cell.wasted,
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
  if (own.value) return;
  if (props.cell.item && usable.value) beginShopDrag(event, source.value, props.cell.item);
}

function onSelect() {
  if (!props.cell.item || !usable.value) return;
  if (own.value) selectOwnCell(props.cell.index, props.cell.item.key, props.cell.price);
  else selectTradeCell(list.value, props.cell.index, props.cell.item.key);
}

function onQuickTrade(event: MouseEvent | KeyboardEvent) {
  if (usable.value && !own.value) void quickTrade(source.value, event.shiftKey);
}

function onNavigate(event: KeyboardEvent) {
  moveGridFocus(event, '[data-trade-cell]');
}

function tooltipPrice(): TooltipPrice | null {
  const { price, affordable } = props.cell;
  return price === null
    ? null
    : { kind: props.kind === 'own' ? 'sell' : props.kind, coins: price, affordable };
}
</script>

<style scoped src="../../../../components/gui/board/board-cell.css"></style>

<style scoped>
.trade-slot {
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 5px;
  min-width: 0;
  padding: 6px;
  border: 1px solid rgba(227, 194, 122, 0.28);
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(34, 44, 54, 0.9), rgba(14, 18, 24, 0.9));
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 4px 10px rgba(0, 0, 0, 0.35);
  transition:
    border-color 0.12s ease,
    box-shadow 0.12s ease;
}
.trade-slot:hover {
  border-color: rgba(227, 194, 122, 0.55);
}
.trade-slot:has(.cell.is-selected) {
  border-color: #e6f1fb;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.55),
    0 0 0 2px rgba(230, 241, 251, 0.55),
    0 0 14px rgba(207, 228, 248, 0.5);
}
.trade-slot:has(.cell.is-sold) {
  opacity: 0.8;
}
.price-section {
  box-sizing: border-box;
  width: 100%;
  min-height: calc(14px * var(--shop-tag-scale, 1) + 8px);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3px 0;
  border-radius: 5px;
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.trade-slot .cell[data-own-empty]::before {
  content: '+';
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: rgba(243, 232, 210, 0.35);
  font-size: 28px;
  font-weight: 700;
}
.trade-slot .cell {
  width: 100%;
  aspect-ratio: var(--shop-slot-ratio, 1);
}
.trade-slot .cell.is-sold {
  cursor: default;
}
.trade-slot .cell.is-sold > * {
  opacity: 0.3;
  pointer-events: none;
}
.sold-label {
  color: #ff9d9d;
  font-size: calc(0.72rem * var(--shop-tag-scale, 1) * 0.8);
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0.04em;
  white-space: nowrap;
  text-transform: uppercase;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}
.trade-slot {
  position: relative;
}
.trade-slot .badge {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 10;
  padding: 1px 6px;
  border-width: 0 1px 1px 0;
  border-style: solid;
  border-color: #e3c27a;
  border-radius: 7px 0 7px 0;
  background: #3a2a0c;
  color: #f0d48a;
  font-size: 12px;
  font-weight: 700;
  line-height: 16px;
}
.trade-slot .amount {
  top: -8px;
  right: -8px;
  bottom: auto;
  z-index: 10;
  min-width: 20px;
  height: 20px;
  box-sizing: border-box;
  display: grid;
  place-items: center;
  padding: 0 5px;
  border: 1px solid #6b7684;
  border-radius: 10px;
  background: #12161b;
  font-size: 12px;
  font-weight: 600;
}
</style>
