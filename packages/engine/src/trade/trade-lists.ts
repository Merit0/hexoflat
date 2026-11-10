import { getMeta } from '../content/content-accessors';
import type { TTraderDefinition } from '../content/content-schema';
import type { BuybackEntry, TraderGood, TraderState } from './trade-state';
import type { ITradeSource } from './trade-types';

function padded<T>(entries: T[], slots: number): (T | null)[] {
  const kept = entries.slice(Math.max(0, entries.length - slots));
  return [...kept, ...Array.from({ length: slots - kept.length }, () => null)];
}

function canJoin(entry: BuybackEntry, sold: BuybackEntry): boolean {
  if (entry.key !== sold.key || entry.unitPrice !== sold.unitPrice) return false;
  const traits = getMeta(sold.key)?.traits;
  if (!traits?.stackable) return false;
  return traits.maxStack === undefined || entry.amount + sold.amount <= traits.maxStack;
}

export function addToBuyback(
  buyback: readonly (BuybackEntry | null)[],
  sold: BuybackEntry,
  slots: number,
): (BuybackEntry | null)[] {
  const entries = buyback.filter((entry): entry is BuybackEntry => entry !== null);
  const at = entries.findIndex((entry) => canJoin(entry, sold));
  if (at === -1) return padded([...entries, { ...sold }], slots);
  entries[at] = { ...entries[at], amount: entries[at].amount + sold.amount };
  return padded(entries, slots);
}

export function readSource(
  state: TraderState,
  from: ITradeSource,
): TraderGood | BuybackEntry | null {
  const list = from.list === 'goods' ? state.goods : state.buyback;
  return list[from.index] ?? null;
}

export function takeFromSource(
  state: TraderState,
  from: ITradeSource,
  amount: number,
  def: TTraderDefinition,
): TraderState {
  if (from.list === 'goods') {
    const goods = state.goods.slice();
    const good = goods[from.index];
    goods[from.index] =
      good && good.amount > amount ? { ...good, amount: good.amount - amount } : null;
    return { ...state, goods };
  }
  const buyback = state.buyback.slice();
  const entry = buyback[from.index];
  buyback[from.index] =
    entry && entry.amount > amount ? { ...entry, amount: entry.amount - amount } : null;
  const left = buyback.filter((cell): cell is BuybackEntry => cell !== null);
  return { ...state, buyback: padded(left, def.buybackSlots) };
}
