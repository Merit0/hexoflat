import { z } from 'zod';
import { hexobjectKeySchema } from '../content/content-schema';
import { TreasureSeekerParamsSchema } from './seeker-content';

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
    })
    .strict(),
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

export const QuestDefinitionSchema = z
  .object({
    id: z.string().min(1),
    nameKey: z.string().min(1),
    descKey: z.string().min(1),
    repeat: z.enum(['once', 'repeatable']),
    requires: z.array(RequirementSchema),
    accept: CostSchema,
    objective: ObjectiveSchema,
    rewards: z.array(RewardSchema),
    turnIn: z.enum(['board', 'auto']),
    maxSellValue: z.number().int().min(0).optional(),
    tableRule: z.string().min(1),
  })
  .strict();
export type QuestDefinition = z.infer<typeof QuestDefinitionSchema>;

export type QuestCatalogue = Readonly<Record<string, QuestDefinition>>;
