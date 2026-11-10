import { TRADERS, type TTraderKey } from '@hexoflat/engine/content/traders.content';
import type { InventoryState } from '@hexoflat/engine/inventory/inventory-state';
import { planBuy } from '@hexoflat/engine/trade/plan-buy';
import { planSell } from '@hexoflat/engine/trade/plan-sell';
import { refreshPrice } from '@hexoflat/engine/trade/trader-view';
import type { TraderState } from '@hexoflat/engine/trade/trade-state';
import type {
  ITradeSource,
  ITraderRef,
  TBuyTarget,
  TTradeError,
  TTradeResult,
} from '@hexoflat/engine/trade/trade-types';

export type TradePreview =
  | { ok: true; price: number; amount: number }
  | { ok: false; reason: TTradeError; price: number }
  | { ok: false; reason: TTradeError; price: null };

const UNKNOWN_PRICE = 0;

function previewOf(result: TTradeResult): TradePreview {
  if (result.ok) return { ok: true, price: result.price, amount: result.amount };
  return result.price === null
    ? { ok: false, reason: result.reason, price: null }
    : { ok: false, reason: result.reason, price: result.price };
}

function settle(plan: (expectedPrice: number) => TTradeResult): TradePreview {
  const probe = plan(UNKNOWN_PRICE);
  if (probe.ok || probe.reason !== 'PRICE_CHANGED' || probe.price === null) return previewOf(probe);
  return previewOf(plan(probe.price));
}

export function previewBuy(
  inventory: InventoryState,
  trader: ITraderRef,
  from: ITradeSource,
  to: TBuyTarget,
  split: boolean,
): TradePreview {
  return settle((expectedPrice) => planBuy(inventory, trader, from, to, { split, expectedPrice }));
}

export function previewSell(
  inventory: InventoryState,
  trader: ITraderRef,
  fromBagIndex: number,
  split: boolean,
): TradePreview {
  return settle((expectedPrice) =>
    planSell(inventory, trader, fromBagIndex, { split, expectedPrice }),
  );
}

export interface RefreshPreview {
  price: number;
  affordable: boolean;
}

export function previewRefresh(
  key: TTraderKey,
  state: TraderState,
  trips: number,
  will: number,
): RefreshPreview {
  const price = refreshPrice(state, trips, TRADERS[key]);
  return { price, affordable: will >= price };
}
