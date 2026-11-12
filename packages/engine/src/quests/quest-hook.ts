import type { ProgressState } from '../aggregates/progress-state';
import type { DomainEvent } from '../commands/types';
import { applyQuestEvents } from './quest-log';
import { QUESTS } from './quests.content';

export function foldQuestEvents<T extends { progress: ProgressState; events: DomainEvent[] }>(
  result: T,
): T {
  if (result.progress.quests.active.length === 0) return result;
  const folded = applyQuestEvents(result.progress, result.events, QUESTS);
  if (folded.progress === result.progress) return result;
  return { ...result, progress: folded.progress, events: [...result.events, ...folded.events] };
}
