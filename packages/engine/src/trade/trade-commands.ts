import { z } from 'zod';
import { TRADER_KEYS } from '../content/traders.content';
import { BAG_CAPACITY } from '../inventory/bag-layout';

const base = {
  heroId: z.string().min(1),
  revision: z.number().int().nonnegative(),
  trader: z.enum(TRADER_KEYS),
  expectedPrice: z.number().int().positive(),
};

const bagIndex = z
  .number()
  .int()
  .min(0)
  .max(BAG_CAPACITY - 1);

export const ShopBuyCommandSchema = z.object({
  type: z.literal('SHOP_BUY'),
  payload: z.object({
    ...base,
    from: z
      .object({ list: z.enum(['goods', 'buyback']), index: z.number().int().min(0).max(63) })
      .strict(),
    to: z.union([
      z.literal('auto'),
      z.object({ container: z.literal('bag'), index: bagIndex }).strict(),
    ]),
    split: z.boolean().default(false),
    amount: z.number().int().min(1).max(9999).optional(),
  }),
});
export type ShopBuyCommand = z.infer<typeof ShopBuyCommandSchema>;

export const ShopDealCommandSchema = z.object({
  type: z.literal('SHOP_DEAL'),
  payload: z.object({
    heroId: z.string().min(1),
    revision: z.number().int().nonnegative(),
    trader: z.enum(TRADER_KEYS),
    index: z.number().int().min(0).max(63),
    guess: z.number().int().min(1).max(999),
    to: z.union([
      z.literal('auto'),
      z.object({ container: z.literal('bag'), index: bagIndex }).strict(),
    ]),
  }),
});
export type ShopDealCommand = z.infer<typeof ShopDealCommandSchema>;

export const ShopSellCommandSchema = z.object({
  type: z.literal('SHOP_SELL'),
  payload: z.object({
    ...base,
    from: z.object({ container: z.literal('bag'), index: bagIndex }).strict(),
    split: z.boolean().default(false),
    amount: z.number().int().min(1).max(9999).optional(),
  }),
});
export type ShopSellCommand = z.infer<typeof ShopSellCommandSchema>;

export const ShopRefreshCommandSchema = z.object({
  type: z.literal('SHOP_REFRESH'),
  payload: z.object(base),
});
export type ShopRefreshCommand = z.infer<typeof ShopRefreshCommandSchema>;

export type ShopCommand = ShopBuyCommand | ShopDealCommand | ShopSellCommand | ShopRefreshCommand;
