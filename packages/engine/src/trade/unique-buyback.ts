import { z } from 'zod';
import { TRADER_KEYS, type TTraderKey } from '../content/traders.content';
import type { InventoryState } from '../inventory/inventory-state';
import type { THexobjectKey } from '../registry/hexobjects-registry';
import { itemTokenSchema, type ItemToken } from '../tokens/token-schema';
import { planBuy } from './plan-buy';
import type { ITradeDeal, ITraderRef, TTradeError } from './trade-types';

export const uniqueBuybackEntrySchema = z
  .object({
    token: itemTokenSchema,
    price: z.number().int().positive(),
    dayId: z.number().int().positive(),
  })
  .strict()
  .refine((entry) => entry.token.tier === 'unique', {
    message: 'only a unique instance can be bought back',
    path: ['token'],
  });
export type UniqueBuybackEntry = z.infer<typeof uniqueBuybackEntrySchema>;

export const uniqueBuybackSchema = z.partialRecord(
  z.enum(TRADER_KEYS),
  z.array(uniqueBuybackEntrySchema),
);
export type UniqueBuyback = z.infer<typeof uniqueBuybackSchema>;

export type TUniqueBuybackError = TTradeError | 'BUY_BACK_GONE';

export type TUniqueBuybackResult =
  | ({ ok: true; entry: UniqueBuybackEntry; left: UniqueBuybackEntry[] } & Omit<
      ITradeDeal,
      'trader'
    >)
  | { ok: false; reason: TUniqueBuybackError; price: number | null };

export function holdsUnique(token: ItemToken | undefined): token is ItemToken {
  return token?.tier === 'unique';
}

export function addUniqueBuyback(
  held: UniqueBuyback,
  trader: TTraderKey,
  entry: UniqueBuybackEntry,
): UniqueBuyback {
  return { ...held, [trader]: [...(held[trader] ?? []), entry] };
}

export function expireUniqueBuyback(
  held: UniqueBuyback,
  dayId: number,
): { held: UniqueBuyback; expired: UniqueBuybackEntry[] } {
  const all = Object.values(held).flat();
  const expired = all.filter((entry) => entry.dayId !== dayId);
  if (expired.length === 0) return { held, expired };
  const kept = Object.entries(held)
    .map(([trader, entries]) => [trader, entries.filter((entry) => entry.dayId === dayId)] as const)
    .filter(([, entries]) => entries.length > 0);
  return { held: Object.fromEntries(kept), expired };
}

export function planUniqueBuyback(
  inventory: InventoryState,
  trader: ITraderRef,
  entries: readonly UniqueBuybackEntry[],
  instanceId: string,
  dayId: number,
): TUniqueBuybackResult {
  const entry = entries.find((candidate) => candidate.token.instanceId === instanceId);
  if (!entry || entry.dayId !== dayId) return { ok: false, reason: 'BUY_BACK_GONE', price: null };
  const key = entry.token.type as THexobjectKey;
  const offered = { key, amount: 1, unitPrice: entry.price, token: entry.token };
  const bought = planBuy(
    inventory,
    { key: trader.key, state: { ...trader.state, buyback: [offered] } },
    { list: 'buyback', index: 0 },
    'auto',
    { split: false, expectedPrice: entry.price },
  );
  if (!bought.ok) return bought;
  return {
    ok: true,
    inventory: bought.inventory,
    key,
    amount: bought.amount,
    price: bought.price,
    entry,
    left: entries.filter((candidate) => candidate !== entry),
  };
}
