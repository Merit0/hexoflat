import type { TTraderKey } from '@hexoflat/engine/content/traders.content';
import type { InventoryState } from '@hexoflat/engine/inventory/inventory-state';
import type { ITradeSource, ITraderRef, TBuyTarget } from '@hexoflat/engine/trade/trade-types';
import { inventorySession } from '@/services/inventory/inventory-session';
import { readInventoryState } from '@/services/inventory/inventory-store-io';
import {
  sendInventoryCommand,
  sendProgress,
  type InventoryCommandResult,
} from '@/services/inventory/inventory-sync';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { previewBuy, previewRefresh, previewSell } from './trade-preview';
import { traderProjection } from './trader-projection';

export type TradeOutcome = { ok: true } | { ok: false; reason: string; price: number | null };

export function currentInventory(): InventoryState {
  return readInventoryState({ inventory: useHeroInventoryStore(), stash: useHeroStashStore() });
}

export function traderRef(key: TTraderKey): ITraderRef | null {
  const state = traderProjection.value.traders[key];
  return state ? { key, state } : null;
}

function outcomeOf(answer: Pick<InventoryCommandResult, 'ok' | 'code' | 'events'>): TradeOutcome {
  if (answer.ok) return { ok: true };
  const event = answer.events.find((candidate) => candidate.type === 'TRADE_REJECTED');
  const payload = event?.payload as { reason?: string; price?: number | null } | undefined;
  return {
    ok: false,
    reason: payload?.reason ?? answer.code ?? 'REJECTED',
    price: payload?.price ?? null,
  };
}

const NO_TRADER: TradeOutcome = { ok: false, reason: 'NOT_AT_TRADER', price: null };

export async function buyFromTrader(
  key: TTraderKey,
  from: ITradeSource,
  to: TBuyTarget,
  split = false,
  amount?: number,
): Promise<TradeOutcome> {
  const trader = traderRef(key);
  if (!trader) return NO_TRADER;
  const entry = from.list === 'goods' ? trader.state.goods[from.index] : null;
  if (entry?.discountPercent) return { ok: false, reason: 'NEEDS_DEAL', price: null };
  const preview = previewBuy(currentInventory(), trader, from, to, split, amount);
  if (preview.price === null) return { ok: false, reason: preview.reason, price: null };
  const payload = { trader: key, from, to, split, amount, expectedPrice: preview.price };
  return outcomeOf(await sendInventoryCommand('SHOP_BUY', payload));
}

export type DealOutcome =
  | { kind: 'bought'; price: number; saved: number }
  | { kind: 'wasted' }
  | { kind: 'refused'; reason: string; price: number | null };

export async function dealWithTrader(
  key: TTraderKey,
  index: number,
  guess: number,
): Promise<DealOutcome> {
  if (!traderRef(key)) return { kind: 'refused', reason: 'NOT_AT_TRADER', price: null };
  const answer = await sendInventoryCommand('SHOP_DEAL', {
    trader: key,
    index,
    guess,
    to: 'auto',
  });
  const wasted = answer.events.some((event) => event.type === 'DEAL_WASTED');
  if (answer.ok && wasted) return { kind: 'wasted' };
  const bought = answer.events.find((event) => event.type === 'ITEM_BOUGHT');
  if (answer.ok && bought) {
    const payload = bought.payload as { price: number; saved?: number };
    return { kind: 'bought', price: payload.price, saved: payload.saved ?? 0 };
  }
  const failed = outcomeOf(answer);
  return failed.ok
    ? { kind: 'refused', reason: 'REJECTED', price: null }
    : { kind: 'refused', reason: failed.reason, price: failed.price };
}

export async function sellToTrader(
  key: TTraderKey,
  fromBagIndex: number,
  split = false,
  amount?: number,
): Promise<TradeOutcome> {
  const trader = traderRef(key);
  if (!trader) return NO_TRADER;
  const preview = previewSell(currentInventory(), trader, fromBagIndex, split, amount);
  if (preview.price === null) return { ok: false, reason: preview.reason, price: null };
  const from = { container: 'bag', index: fromBagIndex };
  const payload = { trader: key, from, split, amount, expectedPrice: preview.price };
  return outcomeOf(await sendInventoryCommand('SHOP_SELL', payload));
}

export async function refreshTrader(key: TTraderKey): Promise<TradeOutcome> {
  const trader = traderRef(key);
  if (!trader) return NO_TRADER;
  const will = inventorySession.knowledge?.current ?? 0;
  const { price } = previewRefresh(key, trader.state, traderProjection.value.trips, will);
  const answer = await sendProgress('SHOP_REFRESH', { trader: key, expectedPrice: price });
  return outcomeOf({ ...answer, events: answer.events ?? [] });
}
