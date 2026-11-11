import { z } from 'zod';
import { coinPriceOf } from '../content/content-accessors';
import { TRADERS, TRADER_KEYS } from '../content/traders.content';
import type { ProgressState } from '../aggregates/progress-state';
import { listingsSchema } from './listing-state';
import { buybackEntrySchema, traderGoodSchema } from './trade-state';
import { traderView } from './trader-view';

export const traderFixtureSchema = z
  .object({
    trader: z.enum(TRADER_KEYS),
    goods: z.array(traderGoodSchema.nullable()).optional(),
    buyback: z.array(buybackEntrySchema.nullable()).optional(),
    trips: z.number().int().nonnegative().optional(),
    listings: listingsSchema.optional(),
  })
  .strict();
export type TraderFixture = z.infer<typeof traderFixtureSchema>;

function padded<T>(cells: readonly (T | null)[], slots: number): (T | null)[] {
  return Array.from({ length: slots }, (_, index) => cells[index] ?? null);
}

export function applyTraderFixture(
  progress: ProgressState,
  rngSeed: string,
  fixture: TraderFixture,
): ProgressState | null {
  const def = TRADERS[fixture.trader];
  const { goods, buyback } = fixture;
  if (goods && goods.length > def.goodsSlots) return null;
  if (buyback && buyback.length > def.buybackSlots) return null;
  const listed = [...(goods ?? []), ...(buyback ?? [])];
  if (listed.some((cell) => cell !== null && coinPriceOf(cell.key) === null)) return null;

  const trips = fixture.trips ?? progress.trips;
  const current = traderView({ ...progress, trips }, fixture.trader, rngSeed);
  const trader = {
    ...current,
    goods: goods ? padded(goods, def.goodsSlots) : current.goods,
    buyback: buyback ? padded(buyback, def.buybackSlots) : current.buyback,
  };
  return {
    ...progress,
    trips,
    listings: fixture.listings ?? progress.listings,
    traders: { ...progress.traders, [fixture.trader]: trader },
  };
}
