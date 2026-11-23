import { z } from 'zod';

const base = {
  heroId: z.string().min(1),
  revision: z.number().int().nonnegative(),
};
const quest = { ...base, questId: z.string().min(1).max(64) };

export const QuestAcceptCommandSchema = z.object({
  type: z.literal('QUEST_ACCEPT'),
  payload: z.object(quest),
});

export const QuestAbandonCommandSchema = z.object({
  type: z.literal('QUEST_ABANDON'),
  payload: z.object(quest),
});

export const QuestClaimCommandSchema = z.object({
  type: z.literal('QUEST_CLAIM'),
  payload: z.object(quest),
});

export const QuestBoardSyncCommandSchema = z.object({
  type: z.literal('QUEST_BOARD_SYNC'),
  payload: z.object(base),
});
export const QuestBoardRefreshCommandSchema = z.object({
  type: z.literal('QUEST_BOARD_REFRESH'),
  payload: z.object({
    ...base,
    dayId: z.number().int().positive(),
    expectedPrice: z.number().int().positive(),
  }),
});
export type QuestBoardCommand =
  z.infer<typeof QuestBoardSyncCommandSchema> | z.infer<typeof QuestBoardRefreshCommandSchema>;

export function isQuestBoardCommand(type: string): type is QuestBoardCommand['type'] {
  return type === 'QUEST_BOARD_SYNC' || type === 'QUEST_BOARD_REFRESH';
}

export type QuestCommand =
  | z.infer<typeof QuestAcceptCommandSchema>
  | z.infer<typeof QuestAbandonCommandSchema>
  | z.infer<typeof QuestClaimCommandSchema>;
