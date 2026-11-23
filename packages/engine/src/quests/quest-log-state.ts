import { z } from 'zod';
import { QUEST_BOARD_SIZE, questOfferSchema } from './quest-offer';

export const activeQuestSchema = z
  .object({
    questId: z.string().min(1),
    progress: z.number().int().nonnegative(),
    state: z.enum(['active', 'ready']),
  })
  .strict();
export type ActiveQuest = z.infer<typeof activeQuestSchema>;

export const questLogSchema = z
  .object({
    active: z.array(activeQuestSchema).max(16),
    done: z.record(z.string(), z.number().int().positive()),
    placementActivations: z.record(z.string(), z.number().int().positive()).optional(),
    offers: z.array(questOfferSchema).max(QUEST_BOARD_SIZE).optional(),
  })
  .strict()
  .refine(({ offers = [] }) => new Set(offers.map((offer) => offer.id)).size === offers.length, {
    path: ['offers'],
    message: 'Duplicate quest offer ID',
  });
export type QuestLog = z.infer<typeof questLogSchema>;

export function emptyQuestLog(): QuestLog {
  return { active: [], done: {} };
}
