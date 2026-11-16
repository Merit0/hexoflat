import { z } from 'zod';
import type { ProgressState } from '../aggregates/progress-state';
import { activeQuestSchema } from './quest-log-state';
import { QUESTS } from './quests.content';

export const questFixtureSchema = z
  .object({
    active: z.array(activeQuestSchema).max(16).optional(),
    done: z.record(z.string(), z.number().int().positive()).optional(),
  })
  .strict();
export type QuestFixture = z.infer<typeof questFixtureSchema>;

export function applyQuestFixture(
  progress: ProgressState,
  fixture: QuestFixture,
): ProgressState | null {
  const known = (id: string) => Object.hasOwn(QUESTS, id);
  if ((fixture.active ?? []).some((entry) => !known(entry.questId))) return null;
  if (Object.keys(fixture.done ?? {}).some((id) => !known(id))) return null;
  return {
    ...progress,
    quests: {
      ...progress.quests,
      active: fixture.active ?? progress.quests.active,
      done: fixture.done ?? progress.quests.done,
    },
  };
}
