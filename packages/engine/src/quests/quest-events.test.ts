import { describe, expect, it } from 'vitest';
import { applyKnowledgeCommand } from '../knowledge/reducer';
import { createKnowledgeState, type HallSession } from '../knowledge/state';
import type { KnowledgeAction, KnowledgeContext } from '../knowledge/commands';

const hall: KnowledgeContext = {
  locationKey: 'camping',
  willZone: 'free',
  mapId: 'camp',
  combatActive: false,
  moving: false,
  atBook: true,
};

describe('events the quests listen to', () => {
  it('REQ-QB-003: the Book of Will reports every answer with its correctness', () => {
    const state = createKnowledgeState('hero');
    state.current = 0;
    const send = (action: KnowledgeAction) =>
      applyKnowledgeCommand(
        state,
        { type: 'KNOWLEDGE', payload: { heroId: 'hero', revision: state.revision, action } },
        hall,
      );
    send({ kind: 'start', mode: 'hall', seed: 'quest' });
    const session = () => state.session as HallSession;
    const question = session().question;
    const wrong = question.options.find((option) => option !== question.answer)!;
    const events = send({
      kind: 'answer',
      sessionId: session().id,
      questionId: question.id,
      answer: wrong,
    });
    expect(events.filter((e) => e.type === 'HALL_ANSWERED')).toEqual([
      { type: 'HALL_ANSWERED', payload: { heroId: 'hero', correct: false } },
    ]);
    send({ kind: 'next', sessionId: session().id, questionId: question.id });
    const next = session().question;
    const right = send({
      kind: 'answer',
      sessionId: session().id,
      questionId: next.id,
      answer: next.answer,
    });
    expect(right.find((e) => e.type === 'HALL_ANSWERED')?.payload).toEqual({
      heroId: 'hero',
      correct: true,
    });
  });
});
