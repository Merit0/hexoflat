import type { TTraderKey } from '../content/traders.content';
import type { InventoryState } from '../inventory/inventory-state';
import type { THexobjectKey } from '../registry/hexobjects-registry';
import type { TraderState } from './trade-state';

export type TTradeError =
  | 'EMPTY_SOURCE'
  | 'NOT_TRADEABLE'
  | 'PRICE_CHANGED'
  | 'NOT_ENOUGH_COINS'
  | 'STACK_FULL'
  | 'SPLIT_TARGET_TAKEN'
  | 'CONTAINER_FULL'
  | 'OVERWEIGHT'
  | 'WILL_REJECTED';

export type TTradeList = 'goods' | 'buyback';

export interface ITradeSource {
  list: TTradeList;
  index: number;
}

export type TBuyTarget = { container: 'bag'; index: number } | 'auto';

export interface ITraderRef {
  key: TTraderKey;
  state: TraderState;
}

export interface ITradeOptions {
  split: boolean;
  amount?: number;
  expectedPrice: number;
}

export interface ITradeDeal {
  inventory: InventoryState;
  trader: TraderState;
  key: THexobjectKey;
  amount: number;
  price: number;
}

export type TTradeResult =
  ({ ok: true } & ITradeDeal) | { ok: false; reason: TTradeError; price: number | null };
