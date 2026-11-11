<template>
  <section
    v-if="selected"
    class="card"
    :class="{ 'is-short': !selected.cell.affordable }"
    data-testid="shop-selection"
    :data-list="selected.list"
    :data-item-key="selected.cell.item?.key"
  >
    <div class="who">
      <h4 data-testid="shop-selection-name">{{ name }}</h4>
      <span v-if="amount > 1" class="count" data-testid="shop-selection-amount"
        >× {{ amount }}</span
      >
    </div>
    <span
      class="price"
      data-testid="shop-selection-price"
      :data-price="selected.cell.price ?? undefined"
      :data-affordable="selected.cell.affordable"
    >
      <img :src="COIN_SRC" alt="" aria-hidden="true" />
      {{ selected.cell.price }}
    </span>
    <button type="button" class="buy" data-testid="shop-buy" @click="onBuy">
      {{ selected.list === 'goods' ? i18n.t('shop.buy') : i18n.t('shop.buyBack') }}
    </button>
  </section>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { getMeta, getPrototype } from '@hexoflat/engine';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import type { TTradeList } from '@hexoflat/engine/trade/trade-types';
import {
  clearShopSelection,
  isTradeCellSelected,
  shopSelection,
} from '@/composables/shop-selection';
import type { ShopTradeCell } from '@/composables/use-shop-board-data';
import { quickTrade } from '@/composables/use-shop-drag';

const COIN_SRC = getPrototype(HEXOBJECT_KEYS.COINS).spritePath ?? '';

const props = defineProps<{ goods: ShopTradeCell[]; buyback: ShopTradeCell[] }>();
const i18n = useI18n();

const selected = computed<{ list: TTradeList; cell: ShopTradeCell } | null>(() => {
  const list = shopSelection.list;
  if (!list) return null;
  const cell = (list === 'goods' ? props.goods : props.buyback)[shopSelection.index];
  if (!cell?.item || cell.sold || !isTradeCellSelected(list, cell.index, cell.item.key))
    return null;
  return { list, cell };
});

watch(
  () => shopSelection.list !== null && selected.value === null,
  (stale) => {
    if (stale) clearShopSelection();
  },
);

const amount = computed(() => selected.value?.cell.item?.amount ?? 0);
const name = computed(() => {
  const item = selected.value?.cell.item;
  if (!item) return '';
  const title = getMeta(item.key).title;
  return i18n.te(title) ? i18n.t(title) : title;
});

function onBuy(): void {
  const current = selected.value;
  if (!current) return;
  void quickTrade({ kind: 'trade', list: current.list, index: current.cell.index });
}
</script>

<style scoped>
.card {
  flex: none;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 14px;
  padding: 10px var(--stash-pad);
  background: rgba(120, 160, 170, 0.24);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1) inset;
}
.who {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
h4 {
  margin: 0;
  overflow: hidden;
  font-family: var(--font-main, serif), serif;
  font-size: 1.15rem;
  font-weight: 700;
  font-variant: small-caps;
  letter-spacing: 0.06em;
  color: rgba(255, 236, 186, 0.95);
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}
.count {
  font-size: 0.85rem;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.6);
}
.price {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #ffe98a;
  font-size: 1.45rem;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}
.price img {
  width: 24px;
  height: 24px;
  object-fit: contain;
  flex: none;
}
.card.is-short .price {
  color: #ff9d9d;
}
.buy {
  min-width: 84px;
  height: 36px;
  padding: 0 16px;
  color: #f3e8d2;
  font-family: inherit;
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.03em;
  cursor: pointer;
  transition: transform 0.06s ease;
  border: 1px solid #7a8da0;
  border-radius: 3px;
  background: linear-gradient(180deg, #3d4d5c, #2a3744);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14);
}
.buy:hover {
  background: linear-gradient(180deg, #4a5d6e, #34444f);
}
.buy:active {
  background: linear-gradient(180deg, #1f2a34, #2a3744);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.5);
  transform: translateY(1px) scale(0.97);
}
.buy:focus-visible {
  outline: 3px solid #f5c26b;
  outline-offset: 2px;
}
</style>
