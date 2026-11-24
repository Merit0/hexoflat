import { describe, expect, it } from 'vitest';
import { emptyProgressState } from '../aggregates/progress-state';
import { QUEST_BOARD_RULES } from '../content/quest-board.content';
import { gameDayAt, trackGameDay } from '../game-day/game-day';
import { DEFAULT_DROP_CONTEXT } from '../tokens/drop-context';
import { ALL_QUESTS } from './all-quests';
import { planQuestBoard, refillQuestBoard } from './quest-board';
import { applyQuestEvents } from './quest-log';
import { event } from './quest-test-setup';

const heroId = 'hero';
const now = Date.UTC(2026, 10, 23);
const initial = { ...emptyProgressState(heroId), day: gameDayAt(undefined, now).day };
const ctx = {
  rngSeed: 'server-board-secret',
  locationDropContexts: { silesia: DEFAULT_DROP_CONTEXT },
  rules: { ...QUEST_BOARD_RULES, dailyLimit: 1 },
};
const sync = { type: 'QUEST_BOARD_SYNC', payload: { heroId, revision: 0 } } as const;
const refresh = {
  type: 'QUEST_BOARD_REFRESH',
  payload: { heroId, revision: 0, dayId: 1, expectedPrice: 50 },
} as const;

function opened() {
  const result = planQuestBoard(initial, sync, 1, ctx);
  if (typeof result === 'string') throw new Error(result);
  return result.progress;
}

describe('quest board policy', () => {
  it('applies a configured quota to first issue, refresh and automatic refill', () => {
    const before = opened();
    expect(before.quests.board?.issued).toBe(1);
    expect(before.quests.offers).toHaveLength(1);
    expect(planQuestBoard(before, refresh, 1, ctx)).toBe('QUEST_BOARD_LIMIT');
    expect(before.knowledge.current).toBe(50);
    const claimed = trackGameDay(
      before,
      {
        progress: { ...before, quests: { ...before.quests, offers: [] } },
        events: [{ type: 'QUEST_CLAIMED', payload: { heroId } }],
      },
      now,
    );
    expect(refillQuestBoard(before, claimed, now, ctx)).toBe(claimed);
    const next = trackGameDay(
      claimed.progress,
      { progress: claimed.progress, events: [] },
      now + 86_400_000,
    );
    const refilled = planQuestBoard(next.progress, sync, 2, ctx);
    if (typeof refilled === 'string') throw new Error(refilled);
    expect(refilled.progress.quests.offers).toHaveLength(1);
    expect(refilled.progress.quests.offers![0].dayId).toBe(2);
  });

  it('defers refill when a completion crosses the day threshold', () => {
    const openedToday = opened();
    const before = { ...openedToday, day: { ...openedToday.day!, questsCompleted: 4 } };
    const completed = trackGameDay(
      before,
      {
        progress: { ...before, quests: { ...before.quests, offers: [] } },
        events: [{ type: 'QUEST_CLAIMED', payload: { heroId } }],
      },
      now,
    );
    const unlimited = { ...ctx, rules: QUEST_BOARD_RULES };
    expect(completed.progress.day?.questsCompleted).toBe(5);
    expect(refillQuestBoard(before, completed, now, unlimited)).toBe(completed);
  });

  it('does not charge when the refresh cannot generate a replacement', () => {
    const before = opened();
    expect(
      planQuestBoard(before, refresh, 1, {
        ...ctx,
        rules: QUEST_BOARD_RULES,
        locationDropContexts: {},
      }),
    ).toBe('QUEST_BOARD_UNCHANGED');
    expect(before.knowledge.current).toBe(50);
  });

  it('counts a generated gathering goal only from a trusted allowed location', () => {
    const candidates = planQuestBoard(initial, sync, 1, { ...ctx, rules: QUEST_BOARD_RULES });
    if (typeof candidates === 'string') throw new Error(candidates);
    const before = candidates.progress;
    const offer = before.quests.offers!.find(({ templateId }) => templateId === 'woodcutter')!;
    before.quests.active = [{ questId: offer.id, progress: 0, state: 'active' }];
    const events = [event('RESOURCE_GATHERED', { action: 'CUT', locationKey: 'silesia' })];
    expect(applyQuestEvents(before, events, ALL_QUESTS, undefined, 'silesia-north').progress).toBe(
      before,
    );
    const counted = applyQuestEvents(before, events, ALL_QUESTS, undefined, 'silesia');
    expect(counted.progress.quests.active[0].progress).toBe(1);
  });
});
