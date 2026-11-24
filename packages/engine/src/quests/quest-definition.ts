import { mapTierSchema, uniqueKeySchema } from '../tokens/token-keys';
import { itemTokenSchema } from '../tokens/token-schema';
import { z } from 'zod';
import { hexobjectKeySchema } from '../content/content-schema';
import { TreasureSeekerParamsSchema } from './seeker-content';
import type { EDimension } from '../dimensions/dimensions';
import { LOCATION_DIMENSIONS, LOCATION_KEYS, type LocationKey } from '../registry/location-key';

export const CostSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('free') }).strict(),
  z.object({ kind: z.literal('will'), amount: z.number().int().min(1) }).strict(),
  z
    .object({
      kind: z.literal('item'),
      itemKey: hexobjectKeySchema,
      amount: z.number().int().min(1),
    })
    .strict(),
]);
export type Cost = z.infer<typeof CostSchema>;

export const RequirementSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('questDone'), questId: z.string().min(1) }).strict(),
]);
export type Requirement = z.infer<typeof RequirementSchema>;

export const RewardSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('item'),
      itemKey: hexobjectKeySchema,
      amount: z.number().int().min(1),
      token: itemTokenSchema.optional(),
    })
    .strict()
    .refine(
      ({ token, itemKey, amount }) =>
        !token || (token.tier === 'base' && token.type === itemKey && amount === 1),
      { path: ['token'], message: 'A stored reward token must be one matching base item' },
    ),
  z.object({ kind: z.literal('will'), amount: z.number().int().min(1) }).strict(),
]);
export type Reward = z.infer<typeof RewardSchema>;

export const QUEST_REFUSALS = [
  'UNKNOWN_QUEST',
  'NOT_AT_BOARD',
  'QUEST_ALREADY_ACTIVE',
  'REQUIREMENTS_NOT_MET',
  'QUEST_SLOTS_FULL',
  'INSUFFICIENT_WILL',
  'INSUFFICIENT_ITEMS',
  'NOT_ACTIVE',
  'NOT_READY',
  'AUTO_TURN_IN',
  'BAG_FULL',
  'NO_INVENTORY',
] as const;
export type QuestRefusal = (typeof QUEST_REFUSALS)[number];
export type QuestBoardRefusal =
  | 'QUEST_OFFER_EXPIRED'
  | 'QUEST_OFFER_REQUIRED'
  | 'QUEST_BOARD_STALE'
  | 'QUEST_BOARD_UNCHANGED'
  | 'QUEST_BOARD_LIMIT'
  | 'NO_ROOM_FOR_QUEST_ENTRANCE';

const whereValueSchema = z.union([z.string(), z.number(), z.boolean()]);

export const CountObjectiveSchema = z
  .object({
    kind: z.literal('count'),
    event: z.string().min(1),
    where: z.record(z.string(), whereValueSchema).optional(),
    amountFrom: z.string().min(1).optional(),
    target: z.number().int().min(1),
    unitKey: z.string().min(1),
  })
  .strict();
export type CountObjective = z.infer<typeof CountObjectiveSchema>;

export const ExpeditionObjectiveSchema = z
  .object({
    kind: z.literal('expedition'),
    expedition: z.literal('treasureSeeker'),
    params: TreasureSeekerParamsSchema,
  })
  .strict();
export type ExpeditionObjective = z.infer<typeof ExpeditionObjectiveSchema>;

export const ObjectiveSchema = z.discriminatedUnion('kind', [
  CountObjectiveSchema,
  ExpeditionObjectiveSchema,
]);
export type Objective = z.infer<typeof ObjectiveSchema>;

export const QuestSlotsSchema = z
  .object({
    base: z.number().int().min(1),
    max: z.number().int().min(1),
    extraCost: z.array(z.number().int().min(0)),
  })
  .strict()
  .refine((slots) => slots.max >= slots.base && slots.extraCost.length === slots.max - slots.base, {
    message: 'extraCost must have one entry per slot above base',
  });
export type QuestSlots = z.infer<typeof QuestSlotsSchema>;

export const QUEST_SLOTS: QuestSlots = { base: 1, max: 3, extraCost: [5, 10] };

export const QuestMapObjectPlacementSchema = z
  .object({
    targetMap: z.enum(LOCATION_KEYS),
    objectKey: hexobjectKeySchema,
    strategy: z.literal('random-empty'),
  })
  .strict();

export const RewardDropContextSchema = z.union([
  z.strictObject({ mapTier: mapTierSchema, tier: z.literal('base').optional() }),
  z.strictObject({
    mapTier: mapTierSchema,
    tier: z.literal('unique'),
    templateKey: uniqueKeySchema,
  }),
]);
export type RewardDropContext = z.infer<typeof RewardDropContextSchema>;

export function uniqueRewardKey(quest: { rewardDropContext?: RewardDropContext }): string | null {
  const context = quest.rewardDropContext;
  return context?.tier === 'unique' ? context.templateKey : null;
}

export const QuestDefinitionSchema = z
  .object({
    id: z.string().min(1),
    locations: z.array(z.enum(LOCATION_KEYS)).min(1),
    nameKey: z.string().min(1),
    descKey: z.string().min(1),
    repeat: z.enum(['once', 'repeatable']),
    requires: z.array(RequirementSchema),
    accept: CostSchema,
    objective: ObjectiveSchema,
    mapObjectPlacement: QuestMapObjectPlacementSchema.optional(),
    rewards: z.array(RewardSchema),
    rewardDropContext: RewardDropContextSchema.optional(),
    turnIn: z.enum(['board', 'auto']),
    maxSellValue: z.number().int().min(0).optional(),
    tableRule: z.string().min(1),
  })
  .strict()
  .superRefine((quest, ctx) => {
    const dimensions = new Set(quest.locations.map((location) => LOCATION_DIMENSIONS[location]));
    if (dimensions.size > 1)
      ctx.addIssue({
        code: 'custom',
        path: ['locations'],
        message: `quest:${quest.id}: locations belong to different dimensions: ${[...dimensions].join(', ')}`,
      });
    if (quest.mapObjectPlacement && !quest.locations.includes(quest.mapObjectPlacement.targetMap))
      ctx.addIssue({
        code: 'custom',
        path: ['mapObjectPlacement'],
        message: `quest:${quest.id}: placement must use an execution location`,
      });
  });
export type QuestDefinition = z.infer<typeof QuestDefinitionSchema>;

export function questDimension(quest: { locations: readonly LocationKey[] }): EDimension {
  return LOCATION_DIMENSIONS[quest.locations[0]];
}

export type QuestCatalogue = Readonly<Record<string, QuestDefinition>>;
