import { reactive, ref } from 'vue';
import type { TTradeList } from '@hexoflat/engine/trade/trade-types';

export type ShopSelectionList = TTradeList | 'bag' | 'own';

export interface ShopSelection {
  list: ShopSelectionList | null;
  index: number;
  key: string;
}

export const shopSelection = reactive<ShopSelection>({ list: null, index: -1, key: '' });
export const shopQty = ref(1);
export const shopGuess = ref('');
export const shopListPrice = ref('');

function select(list: ShopSelectionList, index: number, key: string): void {
  const same = shopSelection.list === list && shopSelection.index === index;
  shopSelection.list = list;
  shopSelection.index = index;
  shopSelection.key = key;
  if (!same) {
    shopQty.value = 1;
    shopGuess.value = '';
    shopListPrice.value = '';
  }
}

export function selectTradeCell(list: TTradeList, index: number, key: string): void {
  select(list, index, key);
}

export function selectOwnCell(index: number, key: string, unitPrice: number | null): void {
  select('own', index, key);
  shopListPrice.value = unitPrice === null ? '' : String(unitPrice);
}

export function selectBagCell(index: number, key: string): void {
  select('bag', index, key);
}

export function clearShopSelection(): void {
  shopSelection.list = null;
  shopSelection.index = -1;
  shopSelection.key = '';
  shopQty.value = 1;
  shopGuess.value = '';
  shopListPrice.value = '';
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
