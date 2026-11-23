import { describe, expect, it } from 'vitest';
import { emptyProgressState, type ProgressState } from '../aggregates/progress-state';
import { upcastAggregate } from '../aggregates/registry';
import type { DomainEvent } from '../commands/types';
import { trackGameDay } from './game-day';

const heroId = 'hero';
const beforeMidnight = Date.UTC(2026, 10, 23, 23, 59, 59, 999);
const will = (amount: number, reason = 'step', actor = heroId): DomainEvent => ({
  type: 'WILL_SPENT',
  payload: { heroId: actor, amount, reason },
});
const claim = { type: 'QUEST_CLAIMED', payload: { heroId } };
const travel = { type: 'WORLD_TRAVELLED', payload: { heroId, to: 'cave' } };
const fresh = emptyProgressState(heroId);
const initial = trackGameDay(fresh, { progress: fresh, events: [] }, beforeMidnight).progress;

function apply(
  progress: ProgressState,
  events: DomainEvent[],
  now = beforeMidnight,
  alreadyResolved?: boolean,
) {
  return trackGameDay(
    progress,
    { progress, events },
    now,
    alreadyResolved === undefined ? undefined : { alreadyResolved },
  );
}

describe('game day', () => {
  it('loads pre-day saves and round trips the first played day without changing the quest log', () => {
    const previous = upcastAggregate('progress', 11, fresh, { heroId });
    expect(previous.day).toBeUndefined();
    const started = apply(previous, [will(2)]);
    expect(started.progress.day).toEqual({
      id: 1,
      startedAt: beforeMidnight,
      willSpent: 2,
      questsCompleted: 0,
      caveTrips: 0,
    });
    expect(started.progress.quests).toBe(previous.quests);
    expect(
      upcastAggregate('progress', 11, JSON.parse(JSON.stringify(started.progress)), { heroId }),
    ).toEqual(started.progress);
  });

  it('rolls over exactly at UTC midnight and counts the current action in the new day', () => {
    const spent = apply(initial, [will(10)]).progress;
    expect(apply(spent, []).progress).toBe(spent);
    const next = apply(spent, [will(1)], beforeMidnight + 1);
    expect(next.progress.day).toMatchObject({ id: 2, willSpent: 1, startedAt: beforeMidnight + 1 });
    expect(next.events[0]).toMatchObject({ type: 'GAME_DAY_STARTED', payload: { reason: 'utc' } });
    expect(apply(next.progress, [], beforeMidnight + 1).progress).toBe(next.progress);
  });

  it('creates one day after a long absence and gives UTC priority over activity thresholds', () => {
    const before = {
      ...initial,
      day: { ...initial.day!, willSpent: 150, questsCompleted: 5, caveTrips: 3 },
    };
    const next = apply(before, [], Date.UTC(2026, 11, 2));
    expect(next.events).toEqual([
      {
        type: 'GAME_DAY_STARTED',
        payload: { heroId, dayId: 2, startedAt: Date.UTC(2026, 11, 2), reason: 'utc' },
      },
    ]);
    expect(next.progress.day).toMatchObject({
      id: 2,
      willSpent: 0,
      questsCompleted: 0,
      caveTrips: 0,
    });
    expect(apply(next.progress, []).progress).toBe(next.progress);
  });

  it.each([
    ['willSpent', 150, 'will-spent'],
    ['questsCompleted', 5, 'quests-completed'],
    ['caveTrips', 3, 'cave-trips'],
  ] as const)(
    'starts the next day at the %s threshold on the following command',
    (counter, threshold, reason) => {
      const below = { ...initial, day: { ...initial.day!, [counter]: threshold - 1 } };
      const reached = trackGameDay(
        below,
        { progress: { ...below, trips: 1 }, events: [will(1), claim, travel] },
        beforeMidnight,
      );
      expect(reached.progress.day).toMatchObject({ id: 1, [counter]: threshold });
      expect(reached.events.map((event) => event.type)).not.toContain('GAME_DAY_STARTED');
      const next = apply(reached.progress, []);
      expect(next.events[0].payload).toMatchObject({ dayId: 2, reason });
      expect(next.progress.day).toMatchObject({ willSpent: 0, questsCompleted: 0, caveTrips: 0 });
    },
  );

  it('counts successful out-of-battle Will spending and real cave trips only', () => {
    const events = [
      will(2),
      will(8, 'equipment'),
      will(5, 'combat-boost'),
      will(25, 'quest', 'another-hero'),
      { type: 'WILL_GRANTED', payload: { heroId, amount: 10 } },
      travel,
    ];
    expect(apply(initial, events).progress.day).toMatchObject({ willSpent: 2, caveTrips: 0 });
    const elsewhere = trackGameDay(
      initial,
      {
        progress: { ...initial, trips: 1 },
        events: [{ type: 'WORLD_TRAVELLED', payload: { heroId, to: 'silesia' } }],
      },
      beforeMidnight,
    );
    expect(elsewhere.progress.day).toMatchObject({ caveTrips: 0 });
  });

  it('counts Claim and first Seeker resolution, then skips its collection, pause and closing summary', () => {
    const resolved = { type: 'QUEST_RESOLVED', payload: { heroId, outcome: 'treasure' } };
    const done = apply(initial, [claim, resolved], beforeMidnight, false).progress;
    const closing = { type: 'QUEST_SUMMARY', payload: { selfSteps: 10, outcome: 'treasure' } };
    for (const event of [
      { type: 'QUEST_READY', payload: { heroId } },
      { type: 'QUEST_PAUSED', payload: { heroId } },
      closing,
    ])
      expect(apply(done, [event], beforeMidnight, true).progress.day?.questsCompleted).toBe(2);
  });

  it.each([0, 1])('counts a Seeker failure only if played (%d moves)', (selfSteps) => {
    const summary = { type: 'QUEST_SUMMARY', payload: { selfSteps, outcome: 'stranded' } };
    const failed = apply(initial, [summary], beforeMidnight, false);
    expect(failed.progress.day?.questsCompleted).toBe(selfSteps);
  });
});
