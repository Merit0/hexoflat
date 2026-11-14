import { describe, expect, it } from 'vitest';
import { coordinateKey, getHexNeighbors } from '../utils/hex-utils';
import { planAccept } from './quest-log';
import { inventoryWith, progressWith } from './quest-test-setup';
import { projectQuestForClient } from './projection';
import { positionOf } from './quest-state';
import {
  enterQuest,
  seekerGiveUp,
  seekerReturn,
  seekerStep,
  seekerStepBack,
} from './seeker-actions';
import { SEEKER_CATALOGUE, SEEKER_QUESTS } from './seeker-quests';
import {
  decoyHexAround,
  discBoard,
  followTruth,
  openChestOf,
  must,
  seekerProgress,
  startQuest,
} from './seeker-test-setup';

const SEEDS = Array.from({ length: 300 }, (_, i) => `seed-${i}`);

function ringOf(run: ReturnType<typeof startQuest>['run']) {
  const here = positionOf(run);
  return getHexNeighbors(here)
    .map((hex) => run.revealed[coordinateKey(hex)])
    .filter(Boolean);
}

describe('REQ-QST-007 every open ring holds exactly one hex with the next term', () => {
  for (const id of ['seeker-1', 'seeker-2', 'seeker-3']) {
    it(`${id}: along the true trail`, () => {
      for (const seed of SEEDS) {
        const state = startQuest(id, seed);
        let { progress, run } = state;
        for (let step = 0; step < run.terms.length - 1; step += 1) {
          const key = coordinateKey(run.trail[run.path.length]);
          const next = run.terms[run.path.length];
          const ring = Object.entries(run.revealed).filter(([k]) =>
            getHexNeighbors(positionOf(run)).some((hex) => coordinateKey(hex) === k),
          );
          expect(ring.filter(([, entry]) => entry.number === next).map(([k]) => k)).toEqual([key]);
          const moved = must(seekerStep(progress, run, run.trail[run.path.length], state.board));
          ({ progress, run } = moved);
        }
      }
    });
  }

  it('on a false trail the next false term is on exactly one hex that is not on the true trail', () => {
    for (const seed of SEEDS) {
      const state = startQuest('seeker-1', seed);
      let { progress, run } = state;
      const wrong = must(seekerStep(progress, run, decoyHexAround(run), state.board));
      ({ progress, run } = wrong);
      const trailKeys = new Set(run.trail.map(coordinateKey));
      const line = run.lines[run.lines.length - 1];
      const next = line.values[run.path.length + 1 - line.fromStep];
      const ring = Object.entries(run.revealed).filter(([k]) =>
        getHexNeighbors(positionOf(run)).some((hex) => coordinateKey(hex) === k),
      );
      const hits = ring.filter(([, entry]) => entry.number === next);
      if (run.chest || run.phase === 'lost') continue;
      expect(hits.length).toBe(1);
      expect(trailKeys.has(hits[0][0])).toBe(false);
      expect(ringOf(run).length).toBeGreaterThan(0);
    }
  });
});

describe('REQ-QST-008 starting a seeker quest', () => {
  it('takes only the entry and no step budget, and refuses without the Will', () => {
    const inventory = inventoryWith({});
    const card = SEEKER_QUESTS[0];
    const context = { catalogue: SEEKER_CATALOGUE, atBoard: true };
    const paid = planAccept(progressWith(50), inventory, card.id, context);
    expect(paid.ok && paid.progress.knowledge.current).toBe(30);
    const short = planAccept(progressWith(19), inventory, card.id, context);
    expect(short).toMatchObject({ ok: false, reason: 'INSUFFICIENT_WILL' });
  });

  it('a projection and its texts carry no total', () => {
    const { run } = startQuest('seeker-1', 'seed-a');
    const keys = Object.keys(projectQuestForClient(run)).join(' ');
    expect(keys).not.toMatch(/total|budget|sum|enough/i);
  });

  it('refuses the entry away from the board, without an active quest and while a run exists', () => {
    const board = discBoard();
    const base = {
      questId: 'seeker-1',
      catalogue: SEEKER_CATALOGUE,
      seed: 's',
      board,
      start: board.start,
      atBoard: true,
      hasRun: false,
    };
    const progress = seekerProgress('seeker-1');
    expect(enterQuest(progress, { ...base, atBoard: false })).toMatchObject({
      reason: 'NOT_AT_BOARD',
    });
    expect(enterQuest(seekerProgress('other'), base)).toMatchObject({ reason: 'NOT_ACTIVE' });
    expect(enterQuest(progress, { ...base, hasRun: true })).toMatchObject({
      reason: 'QUEST_IN_PROGRESS',
    });
    expect(enterQuest(progress, { ...base, questId: 'nope' })).toMatchObject({
      reason: 'UNKNOWN_QUEST',
    });
  });
});

describe('REQ-QST-010 what steps cost', () => {
  it('charges the step cost forward and three times that back', () => {
    const state = startQuest('seeker-3', 'seed-b');
    const forward = must(seekerStep(state.progress, state.run, state.run.trail[0], state.board));
    expect(forward.progress.knowledge.current).toBe(50 - 2);
    const back = must(seekerStepBack(forward.progress, forward.run, state.board));
    expect(back.progress.knowledge.current).toBe(50 - 2 - 6);
  });

  it('refuses a step the Will does not cover and reports cost and have', () => {
    const state = startQuest('seeker-3', 'seed-b', 1);
    const refused = seekerStep(state.progress, state.run, state.run.trail[0], state.board);
    expect(refused).toMatchObject({ ok: false, reason: 'INSUFFICIENT_WILL' });
    expect(refused.events[0].payload).toMatchObject({ cost: 2, have: 1 });
  });

  it('refuses a hex that is not next to the hero, not opened, or the one behind', () => {
    const state = startQuest('seeker-1', 'seed-c');
    const far = state.run.trail[5];
    expect(seekerStep(state.progress, state.run, far, state.board)).toMatchObject({
      reason: 'NOT_ADJACENT',
    });
    const moved = must(seekerStep(state.progress, state.run, state.run.trail[0], state.board));
    expect(seekerStep(moved.progress, moved.run, state.run.start, state.board)).toMatchObject({
      reason: 'USE_STEP_BACK',
    });
    const closed = getHexNeighbors(positionOf(moved.run)).find(
      (hex) =>
        !(coordinateKey(hex) in moved.run.revealed) &&
        coordinateKey(hex) !== coordinateKey(state.run.start),
    );
    if (closed) {
      expect(seekerStep(moved.progress, moved.run, closed, state.board)).toMatchObject({
        reason: 'HEX_NOT_REVEALED',
      });
    }
  });
});

describe('REQ-QST-011 the hint', () => {
  it('shows while the path is shorter than hintSteps and nothing went wrong', () => {
    const state = startQuest('seeker-1', 'seed-d');
    let { progress, run } = state;
    for (let i = 0; i < run.hintSteps; i += 1) {
      expect(projectQuestForClient(run).hintHex).toEqual(run.trail[i]);
      ({ progress, run } = must(seekerStep(progress, run, run.trail[i], state.board)));
    }
    expect(projectQuestForClient(run).hintHex).toBeNull();
  });

  it('is gone for good after a wrong step or a step back', () => {
    const state = startQuest('seeker-1', 'seed-d');
    const back = must(
      seekerStepBack(
        must(seekerStep(state.progress, state.run, state.run.trail[0], state.board)).progress,
        must(seekerStep(state.progress, state.run, state.run.trail[0], state.board)).run,
        state.board,
      ),
    );
    expect(projectQuestForClient(back.run).hintHex).toBeNull();
    const again = must(seekerStep(back.progress, back.run, back.run.trail[0], state.board));
    expect(projectQuestForClient(again.run).hintHex).toBeNull();

    const wrong = must(
      seekerStep(state.progress, state.run, decoyHexAround(state.run), state.board),
    );
    expect(projectQuestForClient(wrong.run).hintHex).toBeNull();
  });
});

describe('REQ-QST-012 a wrong step looks like a right one', () => {
  it('has the same event shape and the same projection shape', () => {
    const state = startQuest('seeker-2', 'seed-e');
    const right = must(seekerStep(state.progress, state.run, state.run.trail[0], state.board));
    const wrong = must(
      seekerStep(state.progress, state.run, decoyHexAround(state.run), state.board),
    );
    const shape = (events: typeof right.events) =>
      events.map((event) => [event.type, Object.keys(event.payload as object).join(',')]);
    expect(shape(wrong.events)).toEqual(shape(right.events));
    const keysOf = (run: typeof right.run) => Object.keys(projectQuestForClient(run)).join(',');
    expect(keysOf(wrong.run)).toBe(keysOf(right.run));
    expect(wrong.run.lines).toHaveLength(1);
    expect(right.run.lines).toHaveLength(0);
  });
});

describe('REQ-QST-013 stepping back', () => {
  it('keeps the left hex open with its number, fogs what only it revealed and lifts the deviation', () => {
    const state = startQuest('seeker-1', 'seed-f');
    const wrongHex = decoyHexAround(state.run);
    const wrong = must(seekerStep(state.progress, state.run, wrongHex, state.board));
    const openedByWrong = Object.entries(wrong.run.revealed)
      .filter(([, entry]) => entry.revealedBy === coordinateKey(wrongHex))
      .map(([key]) => key);
    expect(openedByWrong.length).toBeGreaterThan(0);

    const back = must(seekerStepBack(wrong.progress, wrong.run, state.board));
    expect(coordinateKey(wrongHex) in back.run.revealed).toBe(true);
    expect(back.run.visited).toContain(coordinateKey(wrongHex));
    for (const key of openedByWrong) expect(key in back.run.revealed).toBe(false);
    expect(back.run.lines).toHaveLength(0);
    expect(back.events.map((event) => event.type)).toContain('QUEST_HEXES_FOGGED');

    const finished = followTruth({ ...state, progress: back.progress, run: back.run }, 10);
    expect(finished.run.chest).toMatchObject({ kind: 'real' });
    expect(finished.run.lines).toHaveLength(0);
  });

  it('refuses to step back from the start', () => {
    const state = startQuest('seeker-1', 'seed-f');
    expect(seekerStepBack(state.progress, state.run, state.board)).toMatchObject({
      reason: 'NOTHING_TO_STEP_BACK',
    });
  });

  it('makes the chest vanish when its hex is left', () => {
    const state = startQuest('seeker-1', 'seed-g');
    const end = followTruth(state, 10);
    expect(end.run.chest).not.toBeNull();
    const back = must(seekerStepBack(end.progress, end.run, state.board));
    expect(back.run.chest).toBeNull();
    expect(back.events.map((event) => event.type)).toContain('CHEST_VANISHED');
  });
});

const AMBUSH = { ambushEnabled: true };

describe('REQ-QST-014 the chest', () => {
  it('appears on step L of the true trail and of a false one with the same event', () => {
    const state = startQuest('seeker-1', 'seed-h');
    const real = followTruth(state, 10);
    expect(real.run.chest).toMatchObject({ kind: 'real' });
    const realEvent = real.events.find((event) => event.type === 'CHEST_APPEARED')!;

    let { progress, run } = must(
      seekerStep(state.progress, state.run, decoyHexAround(state.run), state.board, AMBUSH),
    );
    let guard = 0;
    while (!run.chest && guard < 12) {
      const line = run.lines[run.lines.length - 1];
      const next = line.values[run.path.length + 1 - line.fromStep];
      const hex = getHexNeighbors(positionOf(run)).find(
        (candidate) =>
          run.revealed[coordinateKey(candidate)]?.number === next &&
          coordinateKey(candidate) in run.revealed,
      );
      if (!hex) break;
      ({ progress, run } = must(seekerStep(progress, run, hex, state.board, AMBUSH)));
      guard += 1;
    }
    expect(run.chest).toMatchObject({ kind: 'lure' });
    const lureShape = Object.keys(
      (run.chest && {
        type: 'CHEST_APPEARED',
        payload: { heroId: 1, questId: 1, hex: 1 },
      })!.payload,
    ).join(',');
    expect(Object.keys(realEvent.payload as object).join(',')).toBe(lureShape);
  });

  it('opening the real chest starts the collect phase, the lure springs an ambush with the count', () => {
    const state = startQuest('seeker-1', 'seed-h');
    const end = followTruth(state, 10);
    const opened = must(openChestOf(state, end));
    expect(opened.run.phase).toBe('collect');
    const left = must(seekerReturn(opened.progress, opened.run));
    expect(left.run.outcome).toBe('treasure');
    expect(left.progress.quests.done['seeker-1']).toBe(1);
    expect(left.progress.quests.active).toEqual([]);

    const lured = structuredClone(end.run);
    lured.chest = { ...lured.chest!, kind: 'lure' };
    lured.lines = [{ fromStep: 3, values: [5, 6] }];
    const sprung = must(openChestOf(state, { progress: end.progress, run: lured }));
    expect(sprung.run.phase).toBe('ambush');
    expect(sprung.events[0]).toMatchObject({ type: 'AMBUSH_SPRUNG', payload: { deviations: 1 } });
  });

  it('refuses OPEN without a chest and away from it', () => {
    const state = startQuest('seeker-1', 'seed-h');
    expect(openChestOf(state, state)).toMatchObject({ reason: 'NO_CHEST' });
    const end = followTruth(state, 10);
    const far = structuredClone(end.run);
    far.chest = { ...far.chest!, hex: state.run.start };
    expect(openChestOf(state, { progress: end.progress, run: far })).toMatchObject({
      reason: 'NOT_ADJACENT',
    });
  });
});

describe('REQ-QST-015 stranded', () => {
  it('fails with STRANDED and frees the slot when the Will is below one step and no chest is near', () => {
    const state = startQuest('seeker-1', 'seed-i', 1);
    const stepped = must(seekerStep(state.progress, state.run, state.run.trail[0], state.board));
    expect(stepped.run.phase).toBe('ended');
    expect(stepped.run.outcome).toBe('stranded');
    expect(stepped.events.map((event) => event.type)).toEqual(
      expect.arrayContaining(['QUEST_FAILED', 'QUEST_SUMMARY']),
    );
    expect(stepped.progress.quests.active).toEqual([]);
    expect(stepped.progress.quests.done['seeker-1']).toBeUndefined();
  });

  it('is not stranded when the chest stands next to the hero', () => {
    const state = startQuest('seeker-1', 'seed-i', 10);
    const end = followTruth(state, 10);
    expect(end.progress.knowledge.current).toBe(0);
    expect(end.run.phase).toBe('walking');
    expect(end.run.chest).not.toBeNull();
  });
});

describe('REQ-QST-016 give up', () => {
  it('ends the walk from any step without a refund or a completion', () => {
    for (const steps of [0, 3, 6]) {
      const state = startQuest('seeker-1', 'seed-j');
      const walked = followTruth(state, steps);
      const left = must(seekerGiveUp(walked.progress, walked.run));
      expect(left.run.outcome).toBe('left');
      expect(left.progress.knowledge.current).toBe(walked.progress.knowledge.current);
      expect(left.progress.quests.active).toEqual([]);
      expect(left.progress.quests.done['seeker-1']).toBeUndefined();
      const failed = left.events.find((event) => event.type === 'QUEST_FAILED');
      expect(failed?.payload).toMatchObject({ reason: 'LEFT' });
    }
  });

  it('is refused once the quest is over', () => {
    const state = startQuest('seeker-1', 'seed-j');
    const left = must(seekerGiveUp(state.progress, state.run));
    expect(seekerGiveUp(left.progress, left.run)).toMatchObject({ reason: 'WRONG_PHASE' });
    expect(seekerStep(left.progress, left.run, state.run.trail[0], state.board)).toMatchObject({
      reason: 'WRONG_PHASE',
    });
  });
});
