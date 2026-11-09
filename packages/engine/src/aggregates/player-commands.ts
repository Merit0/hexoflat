import { z } from 'zod';
import {
  AutoPlaceItemCommandSchema,
  MoveItemCommandSchema,
  SortStashCommandSchema,
  StoreResourcesCommandSchema,
  UnlockStashChestCommandSchema,
} from '../inventory/inventory-commands';
import { KnowledgeCommandSchema } from '../knowledge/commands';
import {
  ResetSkillsCommandSchema,
  SacrificeToSkillCommandSchema,
} from '../commands/hex-engine-commands';
import { EHexActionType } from '../enums/hex-action-type';
import { knowledgeStateSchema } from '../knowledge/state';
import { LOCATION_KEYS } from '../registry/location-key';
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

export const ArriveCommandSchema = z.object({
  type: z.literal('ARRIVE'),
  payload: z.object({
    heroId: z.string().min(1),
    locationKey: z.enum(LOCATION_KEYS),
    mapId: z.string().min(1).max(80),
    coordinates: z.object({
      columnIndex: z.number().int().min(0).max(255),
      rowIndex: z.number().int().min(0).max(255),
    }),
  }),
});

const coordinatesSchema = z.object({
  columnIndex: z.number().int().min(0).max(255),
  rowIndex: z.number().int().min(0).max(255),
});

export const SpendWillCommandSchema = z.object({
  type: z.literal('SPEND_WILL'),
  payload: z.object({
    heroId: z.string().min(1),
    revision: z.number().int().nonnegative(),
    spend: z.discriminatedUnion('kind', [
      z.object({
        kind: z.literal('action'),
        hexobjectKey: z
          .string()
          .refine((key) => key !== 'hand' && KNOWN_KEYS.has(key), 'unknown hexobject key'),
        actionType: z.enum(EHexActionType),
        coordinates: coordinatesSchema,
      }),
      z.object({ kind: z.literal('portal'), target: coordinatesSchema }),
    ]),
  }),
});

export const DevGrantWillCommandSchema = z.object({
  type: z.literal('DEV_GRANT_WILL'),
  payload: z.object({
    heroId: z.string().min(1),
    revision: z.number().int().nonnegative(),
    amount: z.number().int().min(1).max(1000),
  }),
});

export const DevSetKnowledgeCommandSchema = z.object({
  type: z.literal('DEV_SET_KNOWLEDGE'),
  payload: z.object({
    heroId: z.string().min(1),
    revision: z.number().int().nonnegative(),
    knowledge: knowledgeStateSchema,
  }),
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
  KNOWLEDGE: strict(KnowledgeCommandSchema),
  SACRIFICE_TO_SKILL: strict(SacrificeToSkillCommandSchema),
  RESET_SKILLS: strict(ResetSkillsCommandSchema),
  ARRIVE: strict(ArriveCommandSchema),
  SPEND_WILL: strict(SpendWillCommandSchema),
  DEV_GRANT_WILL: strict(DevGrantWillCommandSchema),
  DEV_SET_KNOWLEDGE: strict(DevSetKnowledgeCommandSchema),
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
  KNOWLEDGE: ['progress'],
  SACRIFICE_TO_SKILL: ['progress'],
  RESET_SKILLS: ['progress'],
  ARRIVE: ['progress'],
  SPEND_WILL: ['progress'],
  DEV_GRANT_WILL: ['progress'],
  DEV_SET_KNOWLEDGE: ['progress'],
};

/**
 * What `payload.revision` means. `aggregate`: it must equal the envelope's expected revision of the
 * primary aggregate. `knowledge`: it is checked by the knowledge rules against `knowledge.revision`.
 * `none`: the command carries no revision (the envelope's revision still guards the order).
 */
export const PLAYER_COMMAND_REVISION: Record<
  TPlayerCommandType,
  'aggregate' | 'knowledge' | 'none'
> = {
  MOVE_ITEM: 'aggregate',
  AUTO_PLACE_ITEM: 'aggregate',
  STORE_RESOURCES: 'aggregate',
  SORT_STASH: 'aggregate',
  UNLOCK_STASH_CHEST: 'aggregate',
  CLAIM_CAMP_CHEST: 'aggregate',
  DEV_GRANT_ITEM: 'aggregate',
  DEV_CONSUME_ITEM: 'aggregate',
  DEV_SET_INVENTORY: 'aggregate',
  KNOWLEDGE: 'knowledge',
  SACRIFICE_TO_SKILL: 'knowledge',
  RESET_SKILLS: 'knowledge',
  ARRIVE: 'none',
  SPEND_WILL: 'knowledge',
  DEV_GRANT_WILL: 'knowledge',
  DEV_SET_KNOWLEDGE: 'knowledge',
};

export function isPlayerCommandType(type: string): type is TPlayerCommandType {
  return Object.hasOwn(PLAYER_COMMAND_SCHEMAS, type);
}
