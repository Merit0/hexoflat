import { z } from 'zod';
import {
  AutoPlaceItemCommandSchema,
  MoveItemCommandSchema,
  SortStashCommandSchema,
  StoreResourcesCommandSchema,
  UnlockStashChestCommandSchema,
} from '../inventory/inventory-commands';
import { inventoryStateSchema } from '../inventory/inventory-state';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import type { TAggregateKind } from './aggregate-kinds';

const base = { heroId: z.string().min(1), revision: z.number().int().nonnegative() };

export const ClaimCampChestCommandSchema = z.object({
  type: z.literal('CLAIM_CAMP_CHEST'),
  payload: z.object(base),
});

const KNOWN_KEYS: ReadonlySet<string> = new Set(Object.values(HEXOBJECT_KEYS));

export const DevGrantItemCommandSchema = z.object({
  type: z.literal('DEV_GRANT_ITEM'),
  payload: z.object({
    ...base,
    key: z
      .string()
      .refine((key) => key !== 'hand' && KNOWN_KEYS.has(key), 'unknown or unstorable key'),
    amount: z.number().int().min(1).max(9999),
  }),
});

export const DevConsumeItemCommandSchema = z.object({
  type: z.literal('DEV_CONSUME_ITEM'),
  payload: DevGrantItemCommandSchema.shape.payload,
});

export const DevSetInventoryCommandSchema = z.object({
  type: z.literal('DEV_SET_INVENTORY'),
  payload: z.object({ ...base, inventory: inventoryStateSchema }),
});

function strict<T extends z.ZodLiteral<string>, P extends z.ZodRawShape>(
  schema: z.ZodObject<{ type: T; payload: z.ZodObject<P> }>,
) {
  return z.object({ type: schema.shape.type, payload: schema.shape.payload.strict() }).strict();
}

export const PLAYER_COMMAND_SCHEMAS = {
  MOVE_ITEM: strict(MoveItemCommandSchema),
  AUTO_PLACE_ITEM: strict(AutoPlaceItemCommandSchema),
  STORE_RESOURCES: strict(StoreResourcesCommandSchema),
  SORT_STASH: strict(SortStashCommandSchema),
  UNLOCK_STASH_CHEST: strict(UnlockStashChestCommandSchema),
  CLAIM_CAMP_CHEST: strict(ClaimCampChestCommandSchema),
  DEV_GRANT_ITEM: strict(DevGrantItemCommandSchema),
  DEV_CONSUME_ITEM: strict(DevConsumeItemCommandSchema),
  DEV_SET_INVENTORY: strict(DevSetInventoryCommandSchema),
} as const;

export type TPlayerCommandType = keyof typeof PLAYER_COMMAND_SCHEMAS;
export type PlayerCommand = z.infer<(typeof PLAYER_COMMAND_SCHEMAS)[TPlayerCommandType]>;

/** Aggregates a command reads and may change, in the fixed lock order. */
export const PLAYER_COMMAND_AGGREGATES: Record<TPlayerCommandType, readonly TAggregateKind[]> = {
  MOVE_ITEM: ['inventory'],
  AUTO_PLACE_ITEM: ['inventory'],
  STORE_RESOURCES: ['inventory'],
  SORT_STASH: ['inventory'],
  UNLOCK_STASH_CHEST: ['inventory'],
  CLAIM_CAMP_CHEST: ['inventory', 'progress'],
  DEV_GRANT_ITEM: ['inventory'],
  DEV_CONSUME_ITEM: ['inventory'],
  DEV_SET_INVENTORY: ['inventory'],
};

export function isPlayerCommandType(type: string): type is TPlayerCommandType {
  return Object.hasOwn(PLAYER_COMMAND_SCHEMAS, type);
}
