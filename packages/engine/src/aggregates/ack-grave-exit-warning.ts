import type { DomainEvent } from '../commands/types';
import type { ProgressState } from './progress-state';

export function graveExitWarningAcknowledged(progress: ProgressState): boolean {
  return progress.graveExitWarningAcknowledged;
}

export function ackGraveExitWarning(progress: ProgressState): {
  changed: { progress?: ProgressState };
  events: DomainEvent[];
} {
  if (progress.graveExitWarningAcknowledged) return { changed: {}, events: [] };
  return {
    changed: { progress: { ...progress, graveExitWarningAcknowledged: true } },
    events: [
      { type: 'GRAVE_EXIT_WARNING_ACKNOWLEDGED', payload: { heroId: progress.knowledge.heroId } },
    ],
  };
}
