import { z } from 'zod';

const count = z.number().int().nonnegative();
export const questBoardRulesSchema = z.strictObject({
  dailyLimit: count.optional(),
  refreshBase: count.positive(),
  refreshIncrement: count,
});
export type QuestBoardRules = z.infer<typeof questBoardRulesSchema>;

export const QUEST_BOARD_RULES = Object.freeze(
  questBoardRulesSchema.parse({ refreshBase: 50, refreshIncrement: 25 }),
);
