import { describe, expect, it } from 'vitest';
import { coordinateKey } from '../utils/hex-utils';
import { projectQuestForClient } from './projection';
import { QUESTS, catalogueOf } from './quests.content';
import { seekerStep, seekerStepBack } from './seeker-actions';
import { SEEKER_QUESTS } from './seeker-quests';
import { RULES, type RuleRegistry, type SequenceRule } from './sequences/rules';
import { decoyHexAround, followTruth, must, startQuest } from './seeker-test-setup';

describe('REQ-QST-017 the client sees no secrets', () => {
  it('carries no seed, trail, rule, deviation count, chest kind or closed number', () => {
    const state = startQuest('seeker-2', 'seed-secret');
    const wrong = must(
      seekerStep(state.progress, state.run, decoyHexAround(state.run), state.board),
    );
    const text = JSON.stringify(projectQuestForClient(wrong.run));
    for (const forbidden of [
      'seed-secret',
      'trail',
      'terms',
      'rule',
      'deviation',
      'lines',
      'lure',
      'real',
      'seed',
    ]) {
      expect(text.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
    const opened = new Set(Object.keys(wrong.run.revealed));
    const projected = projectQuestForClient(wrong.run).opened.map((entry) =>
      coordinateKey(entry.hex),
    );
    expect(new Set(projected)).toEqual(opened);
  });

  it('does not change when the true trail changes outside what is open', () => {
    const state = startQuest('seeker-1', 'seed-k');
    const walked = followTruth(state, 5);
    const before = JSON.stringify(projectQuestForClient(walked.run));
    const changed = structuredClone(walked.run);
    changed.trail[changed.trail.length - 1] = state.run.start;
    changed.terms[changed.terms.length - 1] += 7;
    expect(JSON.stringify(projectQuestForClient(changed))).toBe(before);
  });
});

describe('REQ-QST-020 a new rule kind is a registry entry', () => {
  it('plays a whole quest with a kind that exists only in the registry and the content', () => {
    const registry: RuleRegistry = {
      ...RULES,
      triple: {
        params: ['start'],
        build: (v: Readonly<Record<string, number>>) =>
          ({ kind: 'triple', start: v.start }) as unknown as SequenceRule,
        first: (r: SequenceRule) => (r as unknown as { start: number }).start,
        advance: (_r: SequenceRule, _i: number, value: number) => value + 3,
        slips: (_r: SequenceRule, _i: number, value: number) => [value + 4, value + 2],
      },
    };
    const card = SEEKER_QUESTS[0];
    if (card.objective.kind !== 'expedition') throw new Error('not an expedition');
    const custom = catalogueOf([
      {
        ...card,
        id: 'seeker-triple',
        objective: {
          ...card.objective,
          params: {
            ...card.objective.params,
            rulePool: [{ kind: 'triple', weight: 1, params: { start: 2 } }],
          },
        },
      },
    ]);
    const state = startQuest('seeker-triple', 'seed-l', 50, custom, registry);
    const end = followTruth(state, 10, registry);
    expect(end.run.chest).toMatchObject({ kind: 'real' });
    expect(end.run.terms.slice(0, 3)).toEqual([2, 5, 8]);
  });
});

describe('REQ-QST-025 replay', () => {
  it('gives the same events for the same seed and the same commands', () => {
    const play = () => {
      const state = startQuest('seeker-3', 'seed-replay');
      const wrong = must(
        seekerStep(state.progress, state.run, decoyHexAround(state.run), state.board),
      );
      const back = must(seekerStepBack(wrong.progress, wrong.run, state.board));
      const walked = followTruth({ ...state, progress: back.progress, run: back.run }, 4);
      return JSON.stringify([wrong.events, back.events, walked.events, walked.run]);
    };
    expect(play()).toBe(play());
  });

  it('gives different numbers for another seed', () => {
    const a = startQuest('seeker-3', 'seed-one').run;
    const b = startQuest('seeker-3', 'seed-two').run;
    expect(JSON.stringify([a.revealed, a.trail])).not.toBe(JSON.stringify([b.revealed, b.trail]));
  });

  it('returns the same numbers on a hex opened again from the same path', () => {
    const state = startQuest('seeker-1', 'seed-again');
    const first = must(seekerStep(state.progress, state.run, state.run.trail[0], state.board));
    const back = must(seekerStepBack(first.progress, first.run, state.board));
    const second = must(seekerStep(back.progress, back.run, state.run.trail[0], state.board));
    expect(second.run.revealed).toEqual(first.run.revealed);
  });
});

describe('seeker quest content', () => {
  it('has three cards, a requirement chain and nothing on the plain board', () => {
    expect(SEEKER_QUESTS.map((quest) => quest.id)).toEqual(['seeker-1', 'seeker-2', 'seeker-3']);
    expect(SEEKER_QUESTS[1].requires).toEqual([{ kind: 'questDone', questId: 'seeker-1' }]);
    expect(Object.keys(QUESTS)).not.toContain('seeker-1');
  });
});
