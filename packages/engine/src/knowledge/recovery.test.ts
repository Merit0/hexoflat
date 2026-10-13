import { describe, expect, it } from 'vitest';
import { applyKnowledgeCommand } from './reducer';
import { createKnowledgeState, reviewQuestions, type KnowledgeState } from './state';
import type { KnowledgeAction, KnowledgeContext } from './commands';
import { installCampBook } from './camp-book';
import { HexMapBuilder } from '../map/builders/hex-map-builder';

function harness() {
  let state = createKnowledgeState('hero');
  state.current = 0;
  const context: KnowledgeContext = {
    locationKey: 'camping',
    willZone: 'free',
    mapId: 'camp',
    combatActive: false,
    moving: false,
    atBook: true,
  };
  const send = (action: KnowledgeAction) =>
    applyKnowledgeCommand(
      state,
      { type: 'KNOWLEDGE', payload: { heroId: 'hero', revision: state.revision, action } },
      context,
    )[0].type;
  const answer = (correct: boolean) => {
    const session = state.session!;
    const q = session.questions[session.index];
    send({
      kind: 'answer',
      sessionId: session.id,
      questionId: q.id,
      answer: correct ? q.answer : q.options.find((n) => n !== q.answer)!,
    });
    send({ kind: 'next', sessionId: session.id, questionId: q.id });
  };
  return {
    get state() {
      return state;
    },
    context,
    send,
    answer,
    reload() {
      state = JSON.parse(JSON.stringify(state)) as KnowledgeState;
    },
  };
}

describe('challenge recovery and isolation', () => {
  it('preserves Q11 exactly on reload and records the first answer only', () => {
    const h = harness();
    h.send({ kind: 'start', mode: 'hall', seed: 'resume' });
    for (let i = 0; i < 10; i++) h.answer(true);
    const before = JSON.stringify(h.state.session);
    h.reload();
    expect(JSON.stringify(h.state.session)).toBe(before);
    expect(h.state.session!.index).toBe(10);
    const s = h.state.session!;
    const q = s.questions[10];
    h.send({
      kind: 'answer',
      sessionId: s.id,
      questionId: q.id,
      answer: q.options.find((n) => n !== q.answer)!,
    });
    expect(h.send({ kind: 'answer', sessionId: s.id, questionId: q.id, answer: q.answer })).toBe(
      'KNOWLEDGE_REJECTED',
    );
    expect(s.answers[10]).not.toBe(q.answer);
  });
  it('keeps a suspended Hall while returning and restores it at the book', () => {
    const h = harness();
    h.send({ kind: 'start', mode: 'hall', seed: 'hall' });
    h.answer(true);
    const hallId = h.state.session!.id;
    h.context.locationKey = 'silesia';
    h.context.willZone = 'paid';
    h.context.mapId = 'world';
    h.context.atBook = false;
    expect(h.send({ kind: 'start', mode: 'return', seed: 'return' })).toBe('KNOWLEDGE_CHANGED');
    for (let i = 0; i < 20; i++) h.answer(true);
    h.send({ kind: 'return', sessionId: h.state.session!.id, assisted: false });
    h.context.locationKey = 'camping';
    h.context.willZone = 'free';
    h.context.mapId = 'camp';
    h.context.atBook = true;
    h.send({ kind: 'returned', sessionId: h.state.session!.id });
    h.send({ kind: 'open' });
    expect(h.state.session!.id).toBe(hallId);
    expect(h.state.session!.index).toBe(1);
  });
  it('unlocks labelled assistance only after two failures and ten guided answers', () => {
    const h = harness();
    h.context.locationKey = 'silesia';
    h.context.willZone = 'paid';
    for (let run = 0; run < 2; run++) {
      h.send({ kind: 'start', mode: 'return', seed: `fail-${run}` });
      for (let i = 0; i < 20; i++) h.answer(false);
      expect(h.send({ kind: 'return', sessionId: h.state.session!.id, assisted: true })).toBe(
        'KNOWLEDGE_REJECTED',
      );
    }
    const s = h.state.session!;
    const review = reviewQuestions(s);
    for (let i = 0; i < 10; i++)
      h.send({ kind: 'review', sessionId: s.id, index: i, answer: review[i].answer });
    h.send({ kind: 'return', sessionId: s.id, assisted: true });
    expect(s.status).toBe('returning');
    expect(s.assisted).toBe(true);
    expect(h.state.current).toBe(0);
    expect(s.answers.every((a, i) => a !== s.questions[i].answer)).toBe(true);
  });
  it('rejects combat, remote book access, stale location and early rewards', () => {
    const h = harness();
    h.context.atBook = false;
    expect(h.send({ kind: 'start', mode: 'hall', seed: 'bad' })).toBe('KNOWLEDGE_REJECTED');
    h.context.atBook = true;
    h.context.combatActive = true;
    expect(h.send({ kind: 'start', mode: 'hall', seed: 'bad' })).toBe('KNOWLEDGE_REJECTED');
    h.context.combatActive = false;
    h.send({ kind: 'start', mode: 'hall', seed: 'good' });
    expect(h.send({ kind: 'claim', sessionId: h.state.session!.id })).toBe('KNOWLEDGE_REJECTED');
    h.context.mapId = 'another-map';
    const q = h.state.session!.questions[0];
    expect(
      h.send({
        kind: 'answer',
        sessionId: h.state.session!.id,
        questionId: q.id,
        answer: q.answer,
      }),
    ).toBe('KNOWLEDGE_REJECTED');
  });
});

describe('additive Camp migration', () => {
  it('installs the book once without replacing the map or hero', () => {
    const map = new HexMapBuilder().name('camping').width(12).height(12).build();
    const hero = { columnIndex: 0, rowIndex: 0 };
    const count = map.tiles.length;
    installCampBook(map, hero);
    const book = map.tiles.find((t) => t.hexobject?.hexobjectKey === 'knowledge-book')!;
    const snapshot = JSON.stringify(map);
    installCampBook(map, hero);
    expect(JSON.stringify(map)).toBe(snapshot);
    expect(map.tiles.length).toBe(count);
    expect(book.coordinates).not.toEqual(hero);
  });
});
