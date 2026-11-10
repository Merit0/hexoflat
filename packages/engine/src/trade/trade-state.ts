import { z } from 'zod';
import { hexobjectKeySchema } from '../content/content-schema';
import { TRADER_KEYS } from '../content/traders.content';

export const traderGoodSchema = z
  .object({ key: hexobjectKeySchema, amount: z.number().int().positive() })
  .strict();
export type TraderGood = z.infer<typeof traderGoodSchema>;

export const buybackEntrySchema = z
  .object({
    key: hexobjectKeySchema,
    amount: z.number().int().positive(),
    unitPrice: z.number().int().positive(),
  })
  .strict();
export type BuybackEntry = z.infer<typeof buybackEntrySchema>;

export const traderStateSchema = z
  .object({
    serial: z.number().int().nonnegative(),
    trip: z.number().int().nonnegative(),
    paidRefreshes: z.number().int().nonnegative(),
    goods: z.array(traderGoodSchema.nullable()).max(64),
    buyback: z.array(buybackEntrySchema.nullable()).max(64),
  })
  .strict();
export type TraderState = z.infer<typeof traderStateSchema>;

export const tradersStateSchema = z.partialRecord(z.enum(TRADER_KEYS), traderStateSchema);
export type TradersState = z.infer<typeof tradersStateSchema>;
