import { reactive, ref } from 'vue';
import type { TTradeList } from '@hexoflat/engine/trade/trade-types';

export type ShopSelectionList = TTradeList | 'bag';

export interface ShopSelection {
  list: ShopSelectionList | null;
  index: number;
  key: string;
}

export const shopSelection = reactive<ShopSelection>({ list: null, index: -1, key: '' });
export const shopQty = ref(1);

function select(list: ShopSelectionList, index: number, key: string): void {
  const same = shopSelection.list === list && shopSelection.index === index;
  shopSelection.list = list;
  shopSelection.index = index;
  shopSelection.key = key;
  if (!same) shopQty.value = 1;
}

export function selectTradeCell(list: TTradeList, index: number, key: string): void {
  select(list, index, key);
}

export function selectBagCell(index: number, key: string): void {
  select('bag', index, key);
}

export function clearShopSelection(): void {
  shopSelection.list = null;
  shopSelection.index = -1;
  shopSelection.key = '';
  shopQty.value = 1;
}

export function isTradeCellSelected(
  list: ShopSelectionList,
  index: number,
  key: string | null,
): boolean {
  return (
    key !== null &&
    shopSelection.list === list &&
    shopSelection.index === index &&
    shopSelection.key === key
  );
}
