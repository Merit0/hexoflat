import { coinPriceOf } from '../content/content-accessors';
import type { InventoryState } from '../inventory/inventory-state';
import { discountedUnit } from './discount-math';
import { planBuy } from './plan-buy';
import { readSource } from './trade-lists';
import type { TraderGood, TraderState } from './trade-state';
import type { TBuyTarget, ITraderRef, TTradeResult } from './trade-types';

export type TDealResult =
  | { kind: 'bought'; result: Extract<TTradeResult, { ok: true }>; saved: number }
  | { kind: 'wasted'; trader: TraderState; key: TraderGood['key'] }
  | { kind: 'refused'; result: Extract<TTradeResult, { ok: false }> };

function refused(reason: 'EMPTY_SOURCE' | 'NOT_DISCOUNTED'): TDealResult {
  return { kind: 'refused', result: { ok: false, reason, price: null } };
}

export function planDeal(
  inventory: InventoryState,
  trader: ITraderRef,
  index: number,
  to: TBuyTarget,
  guess: number,
): TDealResult {
  const good = readSource(trader.state, { list: 'goods', index });
  if (!good || !('discountPercent' in good) || !good.discountPercent) {
    return refused(good ? 'NOT_DISCOUNTED' : 'EMPTY_SOURCE');
  }
  const exact = discountedUnit(good.key, good.discountPercent);
  if (exact === null) return refused('NOT_DISCOUNTED');
  if (guess !== exact) {
    const goods = trader.state.goods.slice();
    goods[index] = { ...good, wasted: true };
    return { kind: 'wasted', trader: { ...trader.state, goods }, key: good.key };
  }
  const result = planBuy(inventory, trader, { list: 'goods', index }, to, {
    split: false,
    amount: 1,
    expectedPrice: exact,
    unitOverride: exact,
  });
  if (!result.ok) return { kind: 'refused', result };
  return { kind: 'bought', result, saved: (coinPriceOf(good.key) ?? exact) - exact };
}
