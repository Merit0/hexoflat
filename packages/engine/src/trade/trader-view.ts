import { EQUIP_SLOTS } from '../abstraction/hexobject-abstraction';
import { coinPriceOf } from '../content/content-accessors';
import type { TTraderDefinition } from '../content/content-schema';
import { TRADERS, TRADER_KEYS, type TTraderKey } from '../content/traders.content';
import type { InventoryState } from '../inventory/inventory-state';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';
import { deriveStream } from '../utils/random-seeded';
import type { ProgressState } from '../aggregates/progress-state';
import { applyDiscounts } from './discount-math';
import { emptyBuyback, rollGoods } from './roll-goods';
import type { TraderGood, TraderState } from './trade-state';

export function goodsStreamLabel(trader: TTraderKey, serial: number): string {
  return `trader:${trader}:${serial}`;
}

export function rollTraderGoods(
  def: TTraderDefinition,
  rngSeed: string,
  key: TTraderKey,
  serial: number,
): (TraderGood | null)[] {
  const label = goodsStreamLabel(key, serial);
  const goods = rollGoods(def, deriveStream(rngSeed, label));
  return applyDiscounts(def, goods, deriveStream(rngSeed, `${label}:deals`));
}

export function traderView(
  progress: Pick<ProgressState, 'traders' | 'trips'>,
  key: TTraderKey,
  rngSeed: string,
): TraderState {
  const stored = progress.traders[key];
  if (stored) return stored;
  const def = TRADERS[key];
  return {
    serial: 0,
    trip: progress.trips,
    paidRefreshes: 0,
    goods: rollTraderGoods(def, rngSeed, key, 0),
    buyback: emptyBuyback(def),
  };
}

export function sellUnitPrice(def: TTraderDefinition, key: THexobjectKey): number | null {
  if (key === HEXOBJECT_KEYS.COINS) return null;
  const price = coinPriceOf(key);
  if (price === null) return null;
  return Math.max(1, Math.floor((price * def.sellRate.num) / def.sellRate.den));
}

export function refreshPrice(state: TraderState, trips: number, def: TTraderDefinition): number {
  const paid = state.trip === trips ? state.paidRefreshes : 0;
  return def.refresh.baseWill * def.refresh.factor ** paid;
}

export function walletCoins(inventory: Pick<InventoryState, 'bag' | 'equip'>): number {
  const held = [...inventory.bag, ...EQUIP_SLOTS.map((slot) => inventory.equip[slot])];
  return held.reduce(
    (sum, item) => (item?.key === HEXOBJECT_KEYS.COINS ? sum + item.amount : sum),
    0,
  );
}

export function tradersForClient(
  progress: Pick<ProgressState, 'traders' | 'trips'>,
  rngSeed: string,
): Record<TTraderKey, TraderState> {
  return Object.fromEntries(
    TRADER_KEYS.map((key) => [key, traderView(progress, key, rngSeed)]),
  ) as Record<TTraderKey, TraderState>;
}
