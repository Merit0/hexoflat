import { z } from 'zod';
import type { ProgressState } from '../aggregates/progress-state';
import { sha256Hex } from '../utils/hash/sha256';
import { activeQuestSchema } from './quest-log-state';
import { questOfferFor } from './quest-board-state';
import { QUEST_BOARD_SIZE, questOfferSchema, type QuestOffer } from './quest-offer';
import { QUEST_GENERATOR_VERSION, questOfferTextKeys } from './quest-generation.content';
import { QUESTS } from './quests.content';

const UNIQUE_REWARD_TEMPLATE = 'bone-hunter';
const UNIQUE_REWARD_VARIANT = 'quiet-crypt';

export const questFixtureSchema = z
  .object({
    active: z.array(activeQuestSchema).max(16).optional(),
    done: z.record(z.string(), z.number().int().positive()).optional(),
    previousUtcDay: z.literal(true).optional(),
    uniqueReward: z.literal(true).optional(),
  })
  .strict();
export type QuestFixture = z.infer<typeof questFixtureSchema>;

function uniqueRewardOffer(progress: ProgressState, dayId: number): QuestOffer {
  const template = QUESTS[UNIQUE_REWARD_TEMPLATE];
  const times = progress.quests.done[UNIQUE_REWARD_TEMPLATE] ?? 0;
  const label = JSON.stringify(['dev-unique-reward', progress.knowledge.heroId, dayId, times]);
  const { howKey, ...text } = questOfferTextKeys(UNIQUE_REWARD_TEMPLATE, UNIQUE_REWARD_VARIANT);
  return questOfferSchema.parse({
    id: `qo-${sha256Hex(label).slice(0, 32)}`,
    templateId: UNIQUE_REWARD_TEMPLATE,
    variantId: UNIQUE_REWARD_VARIANT,
    generationVersion: QUEST_GENERATOR_VERSION,
    dayId,
    serial: 1,
    definition: {
      ...template,
      ...text,
      repeat: 'repeatable',
      rewards: [{ kind: 'item', itemKey: 'sword', amount: 1 }],
      rewardDropContext: { mapTier: 1, tier: 'unique', templateKey: 'lantern-eater' },
    },
    howKey,
  });
}

function withUniqueRewardOffer(progress: ProgressState): ProgressState | null {
  const { board, active, offers = [] } = progress.quests;
  if (!board) return null;
  const taken = new Set(active.map(({ questId }) => questId));
  if (offers.some(({ id, templateId }) => taken.has(id) && templateId === UNIQUE_REWARD_TEMPLATE))
    return null;
  const kept = offers.filter(({ templateId }) => templateId !== UNIQUE_REWARD_TEMPLATE);
  const spare = kept.findLastIndex(({ id }) => !taken.has(id));
  if (kept.length >= QUEST_BOARD_SIZE && spare >= 0) kept.splice(spare, 1);
  if (kept.length >= QUEST_BOARD_SIZE) return null;
  return {
    ...progress,
    quests: { ...progress.quests, offers: [uniqueRewardOffer(progress, board.dayId), ...kept] },
  };
}

export function applyQuestFixture(
  current: ProgressState,
  fixture: QuestFixture,
): ProgressState | null {
  const progress = fixture.uniqueReward ? withUniqueRewardOffer(current) : current;
  if (!progress) return null;
  const known = (id: string) => Object.hasOwn(QUESTS, id);
  const canSetProgress = (id: string) =>
    known(id) ||
    (progress.quests.active.some(({ questId }) => questId === id) &&
      questOfferFor(progress.quests, id)?.definition.objective.kind === 'count');
  if ((fixture.active ?? []).some(({ questId }) => !canSetProgress(questId))) return null;
  if (Object.keys(fixture.done ?? {}).some((id) => !known(id))) return null;
  if (fixture.previousUtcDay && !progress.day) return null;
  const day =
    fixture.previousUtcDay && progress.day
      ? { ...progress.day, startedAt: Math.max(0, progress.day.startedAt - 24 * 60 * 60 * 1000) }
      : progress.day;
  return {
    ...progress,
    ...(day ? { day } : {}),
    quests: {
      ...progress.quests,
      active: fixture.active ?? progress.quests.active,
      done: fixture.done ?? progress.quests.done,
    },
  };
}
