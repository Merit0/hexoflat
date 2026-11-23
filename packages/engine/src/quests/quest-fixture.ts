import { z } from 'zod';
import type { ProgressState } from '../aggregates/progress-state';
import { activeQuestSchema } from './quest-log-state';
import { questOfferFor } from './quest-board-state';
import { QUESTS } from './quests.content';

export const questFixtureSchema = z
  .object({
    active: z.array(activeQuestSchema).max(16).optional(),
    done: z.record(z.string(), z.number().int().positive()).optional(),
    previousUtcDay: z.literal(true).optional(),
  })
  .strict();
export type QuestFixture = z.infer<typeof questFixtureSchema>;

export function applyQuestFixture(
  progress: ProgressState,
  fixture: QuestFixture,
): ProgressState | null {
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
