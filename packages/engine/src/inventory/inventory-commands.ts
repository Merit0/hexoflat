import { z } from 'zod';
import { EQUIP_SLOTS } from '../abstraction/hexobject-abstraction';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { BAG_CAPACITY } from './bag-layout';
import type { TTransferError } from './transfer-types';
import { STASH_CAPACITY, STASH_MAX_CHESTS } from './stash-constants';

const itemLocationSchema = z.discriminatedUnion('container', [
  z.object({
    container: z.literal('bag'),
    index: z
      .number()
      .int()
      .min(0)
      .max(BAG_CAPACITY - 1),
  }),
  z.object({
    container: z.literal('stash'),
    index: z
      .number()
      .int()
      .min(0)
      .max(STASH_CAPACITY - 1),
  }),
  z.object({ container: z.literal('equip'), slot: z.enum(EQUIP_SLOTS) }),
]);

const KNOWN_KEYS: ReadonlySet<string> = new Set(Object.values(HEXOBJECT_KEYS));

const base = {
  heroId: z.string().min(1),
  revision: z.number().int().nonnegative(),
};
const preferredChest = z
  .number()
  .int()
  .min(0)
  .max(STASH_MAX_CHESTS - 1)
  .optional();

export const MoveItemCommandSchema = z.object({
  type: z.literal('MOVE_ITEM'),
  payload: z.object({
    ...base,
    from: itemLocationSchema,
    to: itemLocationSchema,
    split: z.boolean().default(false),
  }),
});
export type MoveItemCommand = z.infer<typeof MoveItemCommandSchema>;

export const AutoPlaceItemCommandSchema = z.object({
  type: z.literal('AUTO_PLACE_ITEM'),
  payload: z.object({
    ...base,
    from: itemLocationSchema,
    toContainer: z.enum(['bag', 'stash']),
    split: z.boolean().default(false),
    preferredChest,
  }),
});
export type AutoPlaceItemCommand = z.infer<typeof AutoPlaceItemCommandSchema>;

export const StoreResourcesCommandSchema = z.object({
  type: z.literal('STORE_RESOURCES'),
  payload: z.object({ ...base, preferredChest }),
});
export type StoreResourcesCommand = z.infer<typeof StoreResourcesCommandSchema>;

export const SortStashCommandSchema = z.object({
  type: z.literal('SORT_STASH'),
  payload: z.object(base),
});
export type SortStashCommand = z.infer<typeof SortStashCommandSchema>;

export const UnlockStashChestCommandSchema = z.object({
  type: z.literal('UNLOCK_STASH_CHEST'),
  payload: z.object(base),
});
export type UnlockStashChestCommand = z.infer<typeof UnlockStashChestCommandSchema>;

const stockItem = z
  .string()
  .refine((key) => key !== 'hand' && KNOWN_KEYS.has(key), 'unknown or unstorable hexobject key');

export const GrantItemCommandSchema = z.object({
  type: z.literal('GRANT_ITEM'),
  payload: z.object({
    ...base,
    key: stockItem,
    amount: z.number().int().min(1).max(9999),
    source: z.enum(['pickup', 'loot', 'starter', 'dev']),
  }),
});
export type GrantItemCommand = z.infer<typeof GrantItemCommandSchema>;

export const ConsumeItemCommandSchema = z.object({
  type: z.literal('CONSUME_ITEM'),
  payload: z.object({
    ...base,
    key: stockItem,
    amount: z.number().int().min(1).max(9999),
  }),
});
export type ConsumeItemCommand = z.infer<typeof ConsumeItemCommandSchema>;

export type InventoryCommand =
  | MoveItemCommand
  | AutoPlaceItemCommand
  | StoreResourcesCommand
  | SortStashCommand
  | UnlockStashChestCommand;

export interface InventoryContext {
  stashOpen: boolean;
  battleOpen: boolean;
}

export type InventoryRejectReason =
  | 'NO_INVENTORY'
  | 'INVENTORY_STALE'
  | 'HANDS_LOCKED'
  | 'MAX_CHESTS'
  | 'NO_COINS_IN_HAND'
  | 'NOT_ENOUGH_COINS'
  | TTransferError;
