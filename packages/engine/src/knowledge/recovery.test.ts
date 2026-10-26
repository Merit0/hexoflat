import { describe, expect, it } from 'vitest';
import { applyKnowledgeCommand } from './reducer';
import {
  createKnowledgeState,
  knowledgeStateSchema,
  type HallSession,
  type KnowledgeState,
} from './state';
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
    const session = state.session as HallSession;
    const q = session.question;
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
  it('preserves the current Hall question on reload and records the first answer only', () => {
    const h = harness();
    h.send({ kind: 'start', mode: 'hall', seed: 'resume' });
    for (let i = 0; i < 10; i++) h.answer(true);
    const before = JSON.stringify(h.state.session);
    h.reload();
    expect(JSON.stringify(h.state.session)).toBe(before);
    const s = h.state.session as HallSession;
    expect(s.index).toBe(10);
    const q = s.question;
    const wrong = q.options.find((n) => n !== q.answer)!;
    h.send({ kind: 'answer', sessionId: s.id, questionId: q.id, answer: wrong });
    expect(h.send({ kind: 'answer', sessionId: s.id, questionId: q.id, answer: q.answer })).toBe(
      'KNOWLEDGE_REJECTED',
    );
    expect(s.answer).toBe(wrong);
  });
  it('drops an unfinished 20-question Hall saved by the previous version', () => {
    const legacy: Record<string, unknown> = { ...createKnowledgeState('hero') };
    legacy.session = { id: 'hero:1', mode: 'hall', questions: [], answers: [] };
    expect(knowledgeStateSchema.parse(legacy).session).toBeNull();
  });
  it('always starts the Hall from the initial state when the book is opened again', () => {
    const h = harness();
    h.send({ kind: 'start', mode: 'hall', seed: 'hall' });
    h.answer(true);
    expect(h.state.session).not.toBeNull();
    expect(h.send({ kind: 'open' })).toBe('KNOWLEDGE_CHANGED');
    expect(h.state.session).toBeNull();
    expect(h.send({ kind: 'start', mode: 'hall', seed: 'fresh' })).toBe('KNOWLEDGE_CHANGED');
    expect((h.state.session as HallSession).index).toBe(0);
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
    h.context.mapId = 'another-map';
    const q = (h.state.session as HallSession).question;
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
