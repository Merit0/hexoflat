import type { ProgressState } from '../aggregates/progress-state';
import type { DomainEvent } from '../commands/types';
import { applyQuestEvents } from './quest-log';
import { ALL_QUESTS } from './all-quests';
import type { LocationKey } from '../registry/location-key';

export function foldQuestEvents<T extends { progress: ProgressState; events: DomainEvent[] }>(
  result: T,
  locationKey?: LocationKey,
): T {
  if (result.progress.quests.active.length === 0) return result;
  const folded = applyQuestEvents(
    result.progress,
    result.events,
    ALL_QUESTS,
    undefined,
    locationKey,
  );
  if (folded.progress === result.progress) return result;
  return { ...result, progress: folded.progress, events: [...result.events, ...folded.events] };
}
