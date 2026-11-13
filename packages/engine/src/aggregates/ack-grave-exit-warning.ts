import type { DomainEvent } from '../commands/types';
import type { ProgressState } from './progress-state';

export const GRAVE_EXIT_WARNING_MILESTONE = 'grave-exit-warning-acknowledged';

export function graveExitWarningAcknowledged(progress: ProgressState): boolean {
  return progress.claimedRewards.includes(GRAVE_EXIT_WARNING_MILESTONE);
}

export function ackGraveExitWarning(progress: ProgressState): {
  changed: { progress?: ProgressState };
  events: DomainEvent[];
} {
  if (graveExitWarningAcknowledged(progress)) return { changed: {}, events: [] };
  return {
    changed: {
      progress: {
        ...progress,
        claimedRewards: [...progress.claimedRewards, GRAVE_EXIT_WARNING_MILESTONE],
      },
    },
    events: [
      { type: 'GRAVE_EXIT_WARNING_ACKNOWLEDGED', payload: { heroId: progress.knowledge.heroId } },
    ],
  };
}
