import { reactive } from 'vue';
import type { TTradeList } from '@hexoflat/engine/trade/trade-types';

export interface ShopSelection {
  list: TTradeList | null;
  index: number;
  key: string;
}

export const shopSelection = reactive<ShopSelection>({ list: null, index: -1, key: '' });

export function selectTradeCell(list: TTradeList, index: number, key: string): void {
  shopSelection.list = list;
  shopSelection.index = index;
  shopSelection.key = key;
}

export function clearShopSelection(): void {
  shopSelection.list = null;
  shopSelection.index = -1;
  shopSelection.key = '';
}

export function isTradeCellSelected(list: TTradeList, index: number, key: string | null): boolean {
  return (
    key !== null &&
    shopSelection.list === list &&
    shopSelection.index === index &&
    shopSelection.key === key
  );
}
