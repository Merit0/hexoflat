import type { ProgressState } from '../aggregates/progress-state';
import type { QuestLog } from './quest-log-state';

export function questBoardForDay(progress: ProgressState, dayId: number): ProgressState {
  const log = progress.quests;
  if (log.board?.dayId === dayId) return progress;
  const offers =
    log.offers?.filter(({ id }) => log.active.some(({ questId }) => questId === id)) ?? [];
  const expired = new Set(
    log.offers?.filter((offer) => !offers.includes(offer)).map(({ id }) => id),
  );
  const placementActivations =
    log.placementActivations &&
    Object.fromEntries(Object.entries(log.placementActivations).filter(([id]) => !expired.has(id)));
  return {
    ...progress,
    quests: {
      ...log,
      board: { dayId, issued: 0, refreshes: 0 },
      offers,
      ...(placementActivations ? { placementActivations } : {}),
    },
  };
}

export function questOfferFor(log: QuestLog, id: string) {
  return log.offers?.find((offer) => offer.id === id);
}

export function removeQuest(log: QuestLog, id: string, retireOffer = true): void {
  log.active = log.active.filter(({ questId }) => questId !== id);
  if (!retireOffer || !questOfferFor(log, id)) return;
  log.offers = log.offers?.filter((offer) => offer.id !== id);
  if (log.placementActivations) delete log.placementActivations[id];
}
