import { describe, expect, it } from 'vitest';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { fullBag } from '../trade/trade-test-setup';
import {
  applyQuestEvents,
  planAbandon,
  planAccept,
  planClaim,
  questBoardState,
  slotSurcharge,
  type QuestPlan,
} from './quest-log';
import { QUESTS } from './quests.content';
import {
  AT_BOARD,
  catalogueWith,
  counting,
  event,
  inventoryWith,
  progressWith,
} from './quest-test-setup';
import type { ProgressState } from '../aggregates/progress-state';

function accepted(plan: QuestPlan): ProgressState {
  if (!plan.ok) throw new Error(`refused: ${plan.reason}`);
  return plan.progress;
}

function refusalOf(plan: QuestPlan): string | null {
  return plan.ok ? null : plan.reason;
}

function take(progress: ProgressState, ...ids: string[]): ProgressState {
  return ids.reduce((state, id) => accepted(planAccept(state, undefined, id, AT_BOARD)), progress);
}

const chop = event('RESOURCE_GATHERED', { action: 'CUT', hexobjectKey: 'tree', amount: 1 });

describe('quest log: ACCEPT', () => {
  it('REQ-QB-001: pays the accept price and the slot surcharge, and fills the slot', () => {
    const plan = planAccept(progressWith(20), undefined, 'bone-hunter', AT_BOARD);
    const progress = accepted(plan);
    expect(progress.knowledge.current).toBe(15);
    expect(progress.quests.active).toEqual([
      { questId: 'bone-hunter', progress: 0, state: 'active' },
    ]);
    expect(plan.ok && plan.events.map((e) => e.type)).toEqual(['WILL_SPENT', 'QUEST_ACCEPTED']);
    const second = accepted(planAccept(progress, undefined, 'woodcutter', AT_BOARD));
    expect(second.knowledge.current).toBe(10);
  });

  it('REQ-QB-001: each refusal has its own code and leaves the state alone', () => {
    const taken = take(progressWith(40), 'woodcutter');
    const cases: [QuestPlan, string][] = [
      [planAccept(progressWith(40), undefined, 'nope', AT_BOARD), 'UNKNOWN_QUEST'],
      [
        planAccept(progressWith(40), undefined, 'woodcutter', { ...AT_BOARD, atBoard: false }),
        'NOT_AT_BOARD',
      ],
      [planAccept(taken, undefined, 'woodcutter', AT_BOARD), 'QUEST_ALREADY_ACTIVE'],
      [planAccept(progressWith(4), undefined, 'bone-hunter', AT_BOARD), 'INSUFFICIENT_WILL'],
      [
        planAccept(progressWith(40), undefined, 'gated', {
          ...AT_BOARD,
          catalogue: catalogueWith(
            counting('gated', 'X', 1, { requires: [{ kind: 'questDone', questId: 'woodcutter' }] }),
          ),
        }),
        'REQUIREMENTS_NOT_MET',
      ],
    ];
    for (const [plan, code] of cases) {
      expect(refusalOf(plan)).toBe(code);
      expect(plan.ok ? [] : plan.events[0]).toMatchObject({ type: 'QUEST_REJECTED' });
    }
    const short = planAccept(progressWith(3), undefined, 'bone-hunter', AT_BOARD);
    expect(short.ok ? null : short.events[0].payload).toMatchObject({ cost: 5, have: 3 });
  });

  it('REQ-QB-001: an item price is taken from the bag, and refused when short', () => {
    const catalogue = catalogueWith(
      counting('toll', 'X', 1, {
        accept: { kind: 'item', itemKey: HEXOBJECT_KEYS.AXE, amount: 2 },
      }),
    );
    const ctx = { ...AT_BOARD, catalogue };
    expect(refusalOf(planAccept(progressWith(0), undefined, 'toll', ctx))).toBe(
      'INSUFFICIENT_ITEMS',
    );
    const bag = inventoryWith({ 0: [HEXOBJECT_KEYS.AXE, 3] });
    const plan = planAccept(progressWith(0), bag, 'toll', ctx);
    expect(plan.ok && plan.inventory?.bag[0]?.amount).toBe(1);
  });

  it('REQ-QB-002: slots cost 0, +5, +10 from content and the fourth is refused', () => {
    expect(slotSurcharge(0)).toBe(0);
    expect(slotSurcharge(1)).toBe(5);
    expect(slotSurcharge(2)).toBe(10);
    expect(slotSurcharge(3)).toBeNull();
    const first = take(progressWith(50), 'woodcutter');
    expect(first.knowledge.current).toBe(50);
    const second = take(first, 'stonebreaker');
    expect(second.knowledge.current).toBe(45);
    const third = take(second, 'scholar');
    expect(third.knowledge.current).toBe(35);
    expect(refusalOf(planAccept(third, undefined, 'bone-hunter', AT_BOARD))).toBe(
      'QUEST_SLOTS_FULL',
    );
  });

  it('REQ-QB-002: the slot numbers come from content, and a skill can free slots', () => {
    const slots = { base: 2, max: 4, extraCost: [7, 9] };
    expect(slotSurcharge(1, slots)).toBe(0);
    expect(slotSurcharge(2, slots)).toBe(7);
    expect(slotSurcharge(3, slots)).toBe(9);
    expect(slotSurcharge(2, slots, 1)).toBe(0);
    expect(slotSurcharge(3, slots, 1)).toBe(9);
  });
});

describe('quest log: progress', () => {
  it('REQ-QB-003: only a matching event of an active quest counts', () => {
    const active = take(progressWith(0), 'woodcutter');
    const mine = event('RESOURCE_GATHERED', { action: 'MINE', hexobjectKey: 'rock', amount: 2 });
    const otherType = event('HALL_ANSWERED', { correct: true });
    expect(applyQuestEvents(active, [mine, otherType], QUESTS).progress).toBe(active);
    const after = applyQuestEvents(active, [chop, chop], QUESTS).progress;
    expect(after.quests.active[0].progress).toBe(2);
    const idle = progressWith(0);
    expect(applyQuestEvents(idle, [chop], QUESTS).progress).toBe(idle);
  });

  it('REQ-QB-003: events before the quest was taken are not counted', () => {
    const idle = progressWith(0);
    const afterChop = applyQuestEvents(idle, [chop, chop, chop], QUESTS).progress;
    const active = take(afterChop, 'woodcutter');
    expect(active.quests.active[0].progress).toBe(0);
  });

  it('REQ-QB-003: where compares payload fields, amountFrom adds a payload amount', () => {
    const active = take(progressWith(20), 'scholar', 'bone-hunter');
    const wrong = event('HALL_ANSWERED', { correct: false });
    const right = event('HALL_ANSWERED', { correct: true });
    const lost = event('BATTLE_CLOSED', { outcome: 'defeat', kills: 0 });
    const won = event('BATTLE_CLOSED', { outcome: 'victory', kills: 2 });
    const after = applyQuestEvents(active, [wrong, right, lost, won], QUESTS).progress;
    expect(after.quests.active.map((entry) => entry.progress)).toEqual([1, 2]);
  });

  it('REQ-QB-004: progress stops at the target and QUEST_READY fires exactly once', () => {
    const active = take(progressWith(0), 'woodcutter');
    const stream = Array.from({ length: 14 }, () => chop);
    const { progress, events } = applyQuestEvents(active, stream, QUESTS);
    expect(progress.quests.active[0]).toEqual({
      questId: 'woodcutter',
      progress: 10,
      state: 'ready',
    });
    expect(events.filter((e) => e.type === 'QUEST_READY')).toHaveLength(1);
    const again = applyQuestEvents(progress, [chop], QUESTS);
    expect(again.progress).toBe(progress);
    expect(again.events).toEqual([]);
  });

  it('REQ-QB-004: a kill count that overshoots is capped at the target', () => {
    const active = take(progressWith(20), 'bone-hunter');
    const big = event('BATTLE_CLOSED', { outcome: 'victory', kills: 9 });
    const { progress, events } = applyQuestEvents(active, [big], QUESTS);
    expect(progress.quests.active[0]).toMatchObject({ progress: 3, state: 'ready' });
    expect(events).toHaveLength(1);
  });
});

describe('quest log: CLAIM', () => {
  function readyWoodcutter(): ProgressState {
    const active = take(progressWith(0), 'woodcutter');
    return applyQuestEvents(
      active,
      Array.from({ length: 10 }, () => chop),
      QUESTS,
    ).progress;
  }

  it('REQ-QB-005: grants every reward through the inventory and frees the slot', () => {
    const plan = planClaim(readyWoodcutter(), inventoryWith({}), 'woodcutter', AT_BOARD);
    expect(plan.ok && plan.inventory?.bag.filter((item) => item?.key === 'axe').length).toBe(5);
    expect(plan.ok && plan.progress.quests).toEqual({ active: [], done: { woodcutter: 1 } });
    expect(plan.ok && plan.events.map((e) => e.type)).toEqual([
      'ITEM_GRANTED',
      'INVENTORY_CHANGED',
      'QUEST_CLAIMED',
    ]);
  });

  it('REQ-QB-005: a will reward raises Will and a full bag changes nothing', () => {
    const catalogue = catalogueWith(counting('blessing', 'X', 1));
    const ctx = { ...AT_BOARD, catalogue };
    const ready = progressWith(10, {
      quests: { active: [{ questId: 'blessing', progress: 1, state: 'ready' }], done: {} },
    });
    const plan = planClaim(ready, undefined, 'blessing', ctx);
    expect(plan.ok && plan.progress.knowledge.current).toBe(11);
    const stuck = planClaim(readyWoodcutter(), fullBag(), 'woodcutter', AT_BOARD);
    expect(refusalOf(stuck)).toBe('BAG_FULL');
  });

  it('REQ-QB-005: refuses a claim that is not ready, not taken or far from the board', () => {
    const active = take(progressWith(0), 'woodcutter');
    const bag = inventoryWith({});
    expect(refusalOf(planClaim(active, bag, 'woodcutter', AT_BOARD))).toBe('NOT_READY');
    expect(refusalOf(planClaim(progressWith(0), bag, 'woodcutter', AT_BOARD))).toBe('NOT_ACTIVE');
    expect(
      refusalOf(planClaim(readyWoodcutter(), bag, 'woodcutter', { ...AT_BOARD, atBoard: false })),
    ).toBe('NOT_AT_BOARD');
    const auto = catalogueWith(counting('final', 'X', 1, { turnIn: 'auto' }));
    const ready = progressWith(0, {
      quests: { active: [{ questId: 'final', progress: 1, state: 'ready' }], done: {} },
    });
    expect(refusalOf(planClaim(ready, bag, 'final', { ...AT_BOARD, catalogue: auto }))).toBe(
      'AUTO_TURN_IN',
    );
  });

  it('REQ-QB-006: a one-time quest is gone after the claim, a repeatable one returns at zero', () => {
    const once = catalogueWith(counting('relic', 'X', 1, { repeat: 'once' }));
    const ctx = { ...AT_BOARD, catalogue: once };
    const ready = progressWith(0, {
      quests: { active: [{ questId: 'relic', progress: 1, state: 'ready' }], done: {} },
    });
    const claimed = accepted(planClaim(ready, undefined, 'relic', ctx));
    expect(questBoardState(claimed.quests, once.relic)).toBe('finished');
    expect(refusalOf(planAccept(claimed, undefined, 'relic', ctx))).toBe('REQUIREMENTS_NOT_MET');

    const claimedWood = accepted(
      planClaim(readyWoodcutter(), inventoryWith({}), 'woodcutter', AT_BOARD),
    );
    expect(questBoardState(claimedWood.quests, QUESTS.woodcutter)).toBe('open');
    const again = take(claimedWood, 'woodcutter');
    expect(again.quests.active[0].progress).toBe(0);
    expect(again.quests.done.woodcutter).toBe(1);
  });
});

describe('quest log: ABANDON and requirements', () => {
  it('REQ-QB-007: abandoning frees the slot, loses progress and refunds nothing', () => {
    const active = take(progressWith(10), 'bone-hunter', 'woodcutter');
    expect(active.knowledge.current).toBe(0);
    const plan = planAbandon(active, undefined, 'bone-hunter');
    const left = accepted(plan);
    expect(left.knowledge.current).toBe(0);
    expect(left.quests.active.map((entry) => entry.questId)).toEqual(['woodcutter']);
    expect(left.quests.done).toEqual({});
    expect(refusalOf(planAbandon(left, undefined, 'bone-hunter'))).toBe('NOT_ACTIVE');
    expect(slotSurcharge(left.quests.active.length)).toBe(5);
  });

  it('REQ-QB-008: questDone opens a card only after the named quest was completed', () => {
    const chain = catalogueWith(
      counting('first', 'X', 1),
      counting('second', 'X', 1, { requires: [{ kind: 'questDone', questId: 'first' }] }),
    );
    const ctx = { ...AT_BOARD, catalogue: chain };
    const fresh = progressWith(0);
    expect(questBoardState(fresh.quests, chain.second)).toBe('locked');
    const mid = accepted(planAccept(fresh, undefined, 'first', ctx));
    const stillLocked = applyQuestEvents(mid, [event('X')], chain).progress;
    expect(questBoardState(stillLocked.quests, chain.second)).toBe('locked');
    const done = accepted(planClaim(stillLocked, undefined, 'first', ctx));
    expect(questBoardState(done.quests, chain.second)).toBe('open');
    expect(refusalOf(planAccept(fresh, undefined, 'second', ctx))).toBe('REQUIREMENTS_NOT_MET');
  });
});
