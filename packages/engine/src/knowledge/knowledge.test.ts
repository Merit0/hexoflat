import { describe, expect, it } from 'vitest';
import {
  generateHallQuestion,
  generateQuestions,
  accuracy,
  hallAward,
  KNOWLEDGE_RULES,
} from './math';
import { createKnowledgeState, correctCount, type HallSession, type ReturnSession } from './state';
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
    const session = state.session as ReturnSession;
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
  }, 60_000);
  it('reproduces identical questions and rejects fractional scores', () => {
    expect(generateQuestions('same')).toEqual(generateQuestions('same'));
    expect(() => accuracy(15.6)).toThrow();
    expect(accuracy(17)).toBe(85);
  });
  it('rewards one Will per correct answer and two for a fast one', () => {
    expect(hallAward(undefined)).toBe(KNOWLEDGE_RULES.hallAnswerReward);
    expect(hallAward(KNOWLEDGE_RULES.hallFastAnswerMs)).toBe(KNOWLEDGE_RULES.hallFastReward);
    expect(hallAward(KNOWLEDGE_RULES.hallFastAnswerMs + 1)).toBe(KNOWLEDGE_RULES.hallAnswerReward);
  });
  it('draws endless Hall questions that avoid recent facts and are reproducible', () => {
    const recent: string[] = [];
    for (let i = 0; i < 40; i++) {
      const q = generateHallQuestion('hall', i, {}, recent);
      expect(recent).not.toContain(q.factKey);
      expect(q).toEqual(generateHallQuestion('hall', i, {}, recent));
      expect(new Set(q.options).size).toBe(4);
      expect(q.options).toContain(q.answer);
      recent.push(q.factKey);
      if (recent.length > KNOWLEDGE_RULES.hallRecentFacts) recent.shift();
    }
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
  it('awards Will per answer: +2 fast, +1 slow, 0 wrong, with no 20-question limit', () => {
    const { state, send } = fixture(0);
    send({ kind: 'start', mode: 'hall', seed: 'test' });
    const session = () => state.session as HallSession;
    const answer = (correct: boolean, elapsedMs?: number) => {
      const q = session().question;
      send({
        kind: 'answer',
        sessionId: session().id,
        questionId: q.id,
        answer: correct ? q.answer : q.options.find((a) => a !== q.answer)!,
        elapsedMs,
      });
      return q;
    };
    const q = session().question;
    expect(send({ kind: 'next', sessionId: session().id, questionId: q.id })[0].type).toBe(
      'KNOWLEDGE_REJECTED',
    );
    answer(true, 500);
    expect(state.current).toBe(KNOWLEDGE_RULES.hallFastReward);
    expect(session().lastAward).toBe(KNOWLEDGE_RULES.hallFastReward);
    expect(answer(true, 500).id).toBe(q.id);
    expect(state.current).toBe(KNOWLEDGE_RULES.hallFastReward);
    send({ kind: 'next', sessionId: session().id, questionId: q.id });
    answer(true, KNOWLEDGE_RULES.hallFastAnswerMs + 1);
    expect(state.current).toBe(KNOWLEDGE_RULES.hallFastReward + KNOWLEDGE_RULES.hallAnswerReward);
    send({ kind: 'next', sessionId: session().id, questionId: session().question.id });
    const before = state.current;
    answer(false, 100);
    expect(state.current).toBe(before);
    expect(session().lastAward).toBe(0);
    for (let i = 0; i < 25; i++) {
      send({ kind: 'next', sessionId: session().id, questionId: session().question.id });
      answer(true, 100);
    }
    expect(session().index).toBeGreaterThan(20);
    expect(state.current).toBeLessThanOrEqual(KNOWLEDGE_RULES.capacity);
  });
  it('lets the player stop at any time and keeps the question after reload', () => {
    const { state, send } = fixture(0);
    send({ kind: 'start', mode: 'hall', seed: 'stop' });
    const restored = JSON.parse(JSON.stringify(state)) as typeof state;
    expect(restored.session).toEqual(state.session);
  });
  it('ends the Hall session exactly at capacity and never over-grants', () => {
    const { state, send } = fixture(KNOWLEDGE_RULES.capacity - 1);
    send({ kind: 'start', mode: 'hall', seed: 'cap' });
    const session = state.session as HallSession;
    send({
      kind: 'answer',
      sessionId: session.id,
      questionId: session.question.id,
      answer: session.question.answer,
      elapsedMs: 1,
    });
    expect(state.current).toBe(KNOWLEDGE_RULES.capacity);
    expect(session.lastAward).toBe(1);
    send({ kind: 'next', sessionId: session.id, questionId: session.question.id });
    expect(session.status).toBe('done');
    expect(send({ kind: 'start', mode: 'hall', seed: 'again' })[0].type).toBe('KNOWLEDGE_REJECTED');
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
