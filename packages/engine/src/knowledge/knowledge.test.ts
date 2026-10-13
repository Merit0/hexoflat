import { describe, expect, it } from 'vitest';
import { generateQuestions, accuracy, reward, KNOWLEDGE_RULES } from './math';
import { createKnowledgeState, correctCount } from './state';
import { applyKnowledgeCommand } from './reducer';
import type { KnowledgeAction, KnowledgeContext } from './commands';

const hall: KnowledgeContext = {
  locationKey: 'camping',
  willZone: 'free' as const,
  mapId: 'camp',
  combatActive: false,
  moving: false,
  atBook: true,
};
const world = {
  ...hall,
  locationKey: 'silesia',
  willZone: 'paid' as const,
  mapId: 'world',
  atBook: false,
};
function fixture(current = 0, context = hall) {
  const state = createKnowledgeState('hero');
  state.current = current;
  const send = (action: KnowledgeAction) =>
    applyKnowledgeCommand(
      state,
      { type: 'KNOWLEDGE', payload: { heroId: 'hero', revision: state.revision, action } },
      context,
    );
  const finish = (correct: number) => {
    const session = state.session!;
    for (const [i, q] of session.questions.entries()) {
      send({
        kind: 'answer',
        sessionId: session.id,
        questionId: q.id,
        answer: i < correct ? q.answer : q.options.find((a) => a !== q.answer)!,
      });
      send({ kind: 'next', sessionId: session.id, questionId: q.id });
    }
  };
  return { state, send, finish, context };
}

describe('seeded knowledge questions', () => {
  it('generates valid balanced unique facts and distinct answers across 1000 seeds', () => {
    const slots = [0, 0, 0, 0];
    for (let seed = 0; seed < 1000; seed++) {
      const questions = generateQuestions(String(seed));
      expect(questions).toHaveLength(20);
      expect(new Set(questions.map((q) => q.factKey)).size).toBe(20);
      expect(questions.filter((q) => q.operation === 'multiply')).toHaveLength(10);
      for (const [i, q] of questions.entries()) {
        expect(q.rhs).toBeGreaterThanOrEqual(2);
        expect(q.rhs).toBeLessThanOrEqual(9);
        expect(q.operation === 'multiply' ? q.lhs : q.answer).toBeGreaterThanOrEqual(2);
        expect(q.operation === 'multiply' ? q.lhs : q.answer).toBeLessThanOrEqual(9);
        expect(q.answer).toBe(q.operation === 'multiply' ? q.lhs * q.rhs : q.lhs / q.rhs);
        expect(new Set(q.options).size).toBe(4);
        expect(q.options.filter((a) => a === q.answer)).toHaveLength(1);
        expect(q.options.every((a) => Number.isInteger(a) && a > 0)).toBe(true);
        if (i > 1)
          expect(
            [q.operation, questions[i - 1].operation, questions[i - 2].operation].every(
              (op) => op === q.operation,
            ),
          ).toBe(false);
        slots[q.options.indexOf(q.answer)]++;
      }
    }
    for (const count of slots) expect(count).toBeGreaterThan(4500);
  });
  it('reproduces identical questions and rejects fractional scores', () => {
    expect(generateQuestions('same')).toEqual(generateQuestions('same'));
    expect(() => accuracy(15.6)).toThrow();
    expect(accuracy(17)).toBe(85);
    expect(reward(18, 0, 50)).toBe(41);
    expect(reward(20, 41, 50)).toBe(9);
  });
});

describe('knowledge command guards', () => {
  it('starts fresh heroes full and rejects full Hall, wrong identity and revision', () => {
    const { state, send } = fixture(KNOWLEDGE_RULES.capacity);
    expect(send({ kind: 'start', mode: 'hall', seed: 'test' })[0].type).toBe('KNOWLEDGE_REJECTED');
    expect(state.session).toBeNull();
    expect(
      applyKnowledgeCommand(
        state,
        { type: 'KNOWLEDGE', payload: { heroId: 'other', revision: 0, action: { kind: 'step' } } },
        world,
      )[0].type,
    ).toBe('KNOWLEDGE_REJECTED');
  });
  it('locks first answers, requires feedback and claims capped reward once after reload', () => {
    const { state, send, finish } = fixture(18);
    send({ kind: 'start', mode: 'hall', seed: 'test' });
    const s = state.session!;
    const q = s.questions[0];
    expect(send({ kind: 'next', sessionId: s.id, questionId: q.id })[0].type).toBe(
      'KNOWLEDGE_REJECTED',
    );
    finish(20);
    expect(correctCount(s)).toBe(20);
    send({ kind: 'claim', sessionId: s.id });
    expect(state.current).toBe(KNOWLEDGE_RULES.capacity);
    expect(s.awarded).toBe(KNOWLEDGE_RULES.capacity - 18);
    const restored = JSON.parse(JSON.stringify(state)) as typeof state;
    const events = applyKnowledgeCommand(
      restored,
      {
        type: 'KNOWLEDGE',
        payload: {
          heroId: 'hero',
          revision: restored.revision,
          action: { kind: 'claim', sessionId: s.id },
        },
      },
      hall,
    );
    expect(events[0].type).toBe('KNOWLEDGE_REJECTED');
    expect(restored.current).toBe(KNOWLEDGE_RULES.capacity);
  });
  it.each([16, 17])('return threshold for %i correct and no Will reward', (score) => {
    const { state, send, finish, context } = fixture(0, { ...world });
    send({ kind: 'start', mode: 'return', seed: 'test' });
    finish(score);
    send({ kind: 'return', sessionId: state.session!.id, assisted: false });
    expect(state.session!.status).toBe(score === 17 ? 'returning' : 'result');
    if (score === 17) {
      context.locationKey = 'camping';
      context.willZone = 'free';
      send({ kind: 'returned', sessionId: state.session!.id });
      expect(state.session!.status).toBe('returned');
    }
    expect(state.current).toBe(0);
  });
  it('charges only world steps; permits Camp and combat at zero', () => {
    const { state, send, context } = fixture(1, { ...world });
    send({ kind: 'step' });
    expect(state.current).toBe(0);
    expect(send({ kind: 'step' })[0].type).toBe('KNOWLEDGE_REJECTED');
    context.combatActive = true;
    expect(send({ kind: 'step' })[0].type).toBe('KNOWLEDGE_CHANGED');
    context.combatActive = false;
    context.locationKey = 'camping';
    context.willZone = 'free';
    expect(send({ kind: 'step' })[0].type).toBe('KNOWLEDGE_CHANGED');
    expect(state.current).toBe(0);
  });
});
