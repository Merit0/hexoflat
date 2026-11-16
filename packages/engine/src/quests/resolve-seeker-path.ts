import type { ProgressState } from '../aggregates/progress-state';
import type { DomainEvent } from '../commands/types';
import type { QuestRun } from './quest-state';

export function resolveSeekerPath(progress: ProgressState, run: QuestRun): DomainEvent[] {
  if (run.resolution || (!run.chest && run.phase !== 'lost')) return [];
  run.resolution = run.lines.length === 0 ? 'treasure' : 'lost';
  progress.quests.active = progress.quests.active.filter((entry) => entry.questId !== run.offerId);
  if (run.resolution === 'treasure')
    progress.quests.done[run.offerId] = (progress.quests.done[run.offerId] ?? 0) + 1;
  return [
    {
      type: 'QUEST_RESOLVED',
      payload: { heroId: progress.knowledge.heroId, questId: run.offerId, outcome: run.resolution },
    },
  ];
}
