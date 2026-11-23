import type { ProgressState } from '../aggregates/progress-state';
import type { DomainEvent } from '../commands/types';
import { GAME_DAY_RULES } from '../content/game-day.content';
import type { GameDay } from './game-day-state';

const UTC_DAY_MS = 86_400_000;

type DayStartReason = 'first-action' | 'utc' | 'will-spent' | 'quests-completed' | 'cave-trips';

function startReason(day: GameDay | undefined, now: number): DayStartReason | null {
  if (!day) return 'first-action';
  if (Math.floor(now / UTC_DAY_MS) > Math.floor(day.startedAt / UTC_DAY_MS)) return 'utc';
  if (day.willSpent >= GAME_DAY_RULES.willSpent) return 'will-spent';
  if (day.questsCompleted >= GAME_DAY_RULES.questsCompleted) return 'quests-completed';
  if (day.caveTrips >= GAME_DAY_RULES.caveTrips) return 'cave-trips';
  return null;
}

function willSpent(event: DomainEvent, heroId: string): number {
  if (event.type !== 'WILL_SPENT') return 0;
  const spend = event.payload as { heroId: string; amount: number; reason: string };
  if (spend.heroId !== heroId || spend.reason === 'combat-boost' || spend.reason === 'equipment')
    return 0;
  return spend.amount;
}

function questCompletions(
  events: readonly DomainEvent[],
  heroId: string,
  seeker: { alreadyResolved: boolean } | undefined,
): number {
  const completed = events.filter(
    (event) =>
      (event.type === 'QUEST_CLAIMED' || event.type === 'QUEST_RESOLVED') &&
      (event.payload as { heroId: string }).heroId === heroId,
  ).length;
  if (completed || !seeker || seeker.alreadyResolved) return completed;
  return events.some(
    (event) =>
      event.type === 'QUEST_SUMMARY' && (event.payload as { selfSteps: number }).selfSteps > 0,
  )
    ? 1
    : 0;
}

function caveTrips(before: ProgressState, after: ProgressState, events: readonly DomainEvent[]) {
  if (after.trips <= before.trips) return 0;
  return events.filter((event) => {
    if (event.type !== 'WORLD_TRAVELLED') return false;
    const trip = event.payload as { heroId: string; to: string };
    return trip.heroId === before.knowledge.heroId && trip.to === 'cave';
  }).length;
}

/** Fold one successful, non-replayed command into the day it was executed in. */
export function trackGameDay<T extends { progress: ProgressState; events: DomainEvent[] }>(
  before: ProgressState,
  outcome: T,
  now: number,
  seeker?: { alreadyResolved: boolean },
): T {
  const previous = before.day;
  const reason = startReason(previous, now);
  const current =
    !reason && previous
      ? previous
      : {
          id: (previous?.id ?? 0) + 1,
          startedAt: Math.max(now, previous?.startedAt ?? now),
          willSpent: 0,
          questsCompleted: 0,
          caveTrips: 0,
        };
  const heroId = before.knowledge.heroId;
  const spent = outcome.events.reduce((total, event) => total + willSpent(event, heroId), 0);
  const completed = questCompletions(outcome.events, heroId, seeker);
  const trips = caveTrips(before, outcome.progress, outcome.events);
  if (!reason && spent === 0 && completed === 0 && trips === 0) return outcome;

  const day = {
    ...current,
    willSpent: current.willSpent + spent,
    questsCompleted: current.questsCompleted + completed,
    caveTrips: current.caveTrips + trips,
  };
  const events = reason
    ? [
        {
          type: 'GAME_DAY_STARTED',
          payload: { heroId, dayId: day.id, startedAt: day.startedAt, reason },
        },
        ...outcome.events,
      ]
    : outcome.events;
  return { ...outcome, progress: { ...outcome.progress, day }, events };
}
