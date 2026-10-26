import { describe, expect, it } from 'vitest';
import { generateHallQuestion, hallAward, KNOWLEDGE_RULES } from './math';
import { createKnowledgeState, knowledgeStateSchema, type HallSession } from './state';
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
  return { state, send, context };
}

describe('seeded knowledge questions', () => {
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
  it('drops a saved return challenge from the previous version', () => {
    const saved: Record<string, unknown> = { ...createKnowledgeState('hero') };
    saved.session = { id: 'hero:1', mode: 'return', status: 'result' };
    expect(knowledgeStateSchema.parse(saved).session).toBeNull();
  });
  it('offers the Hall only in a free zone, next to the book', () => {
    const { state, send } = fixture(0, { ...world });
    expect(send({ kind: 'start', mode: 'hall', seed: 'away' })[0].type).toBe('KNOWLEDGE_REJECTED');
    expect(state.session).toBeNull();
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
