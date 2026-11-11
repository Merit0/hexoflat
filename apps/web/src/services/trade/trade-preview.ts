import { coinPriceOf } from '@hexoflat/engine/content/content-accessors';
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
  amount?: number,
): TradePreview {
  const entry = from.list === 'goods' ? trader.state.goods[from.index] : null;
  const unitOverride = entry?.discountPercent ? (coinPriceOf(entry.key) ?? undefined) : undefined;
  return settle((expectedPrice) =>
    planBuy(inventory, trader, from, to, { split, amount, expectedPrice, unitOverride }),
  );
}

export function previewSell(
  inventory: InventoryState,
  trader: ITraderRef,
  fromBagIndex: number,
  split: boolean,
  amount?: number,
): TradePreview {
  return settle((expectedPrice) =>
    planSell(inventory, trader, fromBagIndex, { split, amount, expectedPrice }),
  );
}

export function previewBuyLanding(
  inventory: InventoryState,
  trader: ITraderRef,
  from: ITradeSource,
  split: boolean,
): number | null {
  const preview = previewBuy(inventory, trader, from, 'auto', split);
  if (!preview.ok) return null;
  const result = planBuy(inventory, trader, from, 'auto', { split, expectedPrice: preview.price });
  if (!result.ok) return null;
  const index = result.inventory.bag.findIndex((cell, at) => {
    const before = inventory.bag[at];
    if (!cell || cell.key !== result.key) return false;
    return !before || before.key !== cell.key || before.amount < cell.amount;
  });
  return index === -1 ? null : index;
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
  free = false,
): RefreshPreview {
  const price = free ? 0 : refreshPrice(state, trips, TRADERS[key]);
  return { price, affordable: will >= price };
}
