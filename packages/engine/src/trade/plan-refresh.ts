import type { ProgressState } from '../aggregates/progress-state';
import type { DomainEvent } from '../commands/types';
import { TRADERS, type TTraderKey } from '../content/traders.content';
import { spendWill } from '../knowledge/will';
import { emptyBuyback } from './roll-goods';
import type { TTradeError } from './trade-types';
import { goodsStreamLabel, refreshPrice, rollTraderGoods, traderView } from './trader-view';

export interface IRefreshOptions {
  rngSeed: string;
  expectedPrice: number;
}

export type TRefreshResult =
  | { ok: true; progress: ProgressState; serial: number; price: number; events: DomainEvent[] }
  | { ok: false; reason: TTradeError; price: number };

export function planRefresh(
  progress: ProgressState,
  trader: TTraderKey,
  opts: IRefreshOptions,
): TRefreshResult {
  const def = TRADERS[trader];
  const view = traderView(progress, trader, opts.rngSeed);
  const price = refreshPrice(view, progress.trips, def);
  if (price !== opts.expectedPrice) return { ok: false, reason: 'PRICE_CHANGED', price };

  const next = structuredClone(progress);
  const serial = view.serial + 1;
  const spent = spendWill(
    next.knowledge,
    price,
    'trader-refresh',
    goodsStreamLabel(trader, serial),
  );
  if (!spent.ok) return { ok: false, reason: 'WILL_REJECTED', price };

  const paid = view.trip === progress.trips ? view.paidRefreshes : 0;
  next.traders[trader] = {
    serial,
    trip: progress.trips,
    paidRefreshes: paid + 1,
    goods: rollTraderGoods(def, opts.rngSeed, trader, serial),
    buyback: emptyBuyback(def),
  };
  return { ok: true, progress: next, serial, price, events: spent.events };
}
