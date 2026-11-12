import { z } from 'zod';

const base = {
  heroId: z.string().min(1),
  revision: z.number().int().nonnegative(),
  questId: z.string().min(1).max(64),
};

export const QuestAcceptCommandSchema = z.object({
  type: z.literal('QUEST_ACCEPT'),
  payload: z.object(base),
});

export const QuestAbandonCommandSchema = z.object({
  type: z.literal('QUEST_ABANDON'),
  payload: z.object(base),
});

export const QuestClaimCommandSchema = z.object({
  type: z.literal('QUEST_CLAIM'),
  payload: z.object(base),
});

export type QuestCommand =
  | z.infer<typeof QuestAcceptCommandSchema>
  | z.infer<typeof QuestAbandonCommandSchema>
  | z.infer<typeof QuestClaimCommandSchema>;
