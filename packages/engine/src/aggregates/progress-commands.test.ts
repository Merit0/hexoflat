import { describe, expect, it } from 'vitest';
import { getHexNeighbors } from '../utils/hex-utils';
import { CAMP_BOOK_HEX } from '../knowledge/camp-book';
import {
  PLAYER_COMMAND_SCHEMAS,
  emptyProgressState,
  executePlayerCommand,
  serverKnowledgeContext,
  type PlayerAggregates,
  type PlayerCommand,
  type PlayerCommandContext,
} from './index';
import { emptyInventoryState } from '../inventory/inventory-state';

const HERO = 'hero-1';
const CTX: PlayerCommandContext = {
  devGrantAllowed: false,
  inventory: { stashOpen: true, battleOpen: false },
};

function fresh(): PlayerAggregates {
  return { inventory: emptyInventoryState(HERO), progress: emptyProgressState(HERO) };
}

function parse(command: unknown): PlayerCommand {
  const type = (command as { type: keyof typeof PLAYER_COMMAND_SCHEMAS }).type;
  return PLAYER_COMMAND_SCHEMAS[type].parse(command);
}

const arrive = (locationKey: string, columnIndex: number, rowIndex: number) =>
  parse({
    type: 'ARRIVE',
    payload: {
      heroId: HERO,
      locationKey,
      mapId: `${locationKey}-map`,
      coordinates: { columnIndex, rowIndex },
    },
  });

const step = (revision: number, columnIndex: number, rowIndex: number) =>
  parse({
    type: 'KNOWLEDGE',
    payload: {
      heroId: HERO,
      revision,
      action: { kind: 'step', target: { columnIndex, rowIndex } },
    },
  });

function run(aggregates: PlayerAggregates, command: PlayerCommand) {
  const ctx = command.type === 'ARRIVE' ? { ...CTX, devGrantAllowed: true } : CTX;
  const outcome = executePlayerCommand(aggregates, command, ctx);
  if (!outcome.ok) return { outcome, aggregates };
  return { outcome, aggregates: { ...aggregates, ...outcome.changed } };
}

describe('ARRIVE and steps', () => {
  it('is a dev fixture: a player context refuses to be told where the hero stands', () => {
    const outcome = executePlayerCommand(fresh(), arrive('silesia', 3, 4), CTX);
    expect(outcome).toMatchObject({ ok: false, code: 'FORBIDDEN' });
  });

  it('remembers where the hero stands', () => {
    const { aggregates } = run(fresh(), arrive('silesia', 5, 5));
    expect(aggregates.progress.presence).toMatchObject({
      locationKey: 'silesia',
      coordinates: { columnIndex: 5, rowIndex: 5 },
    });
  });

  it('refuses a location that does not exist and an unknown field', () => {
    const bad = {
      type: 'ARRIVE',
      payload: {
        heroId: HERO,
        locationKey: 'mars',
        mapId: 'm',
        coordinates: { columnIndex: 1, rowIndex: 1 },
      },
    };
    expect(PLAYER_COMMAND_SCHEMAS.ARRIVE.safeParse(bad).success).toBe(false);
    const extra = { ...bad, payload: { ...bad.payload, locationKey: 'camping', will: 99 } };
    expect(PLAYER_COMMAND_SCHEMAS.ARRIVE.safeParse(extra).success).toBe(false);
  });

  it('charges one Will for a step where the location charges, and moves the hero', () => {
    const state = run(fresh(), arrive('silesia', 5, 5)).aggregates;
    const { outcome, aggregates } = run(state, step(0, 5, 6));
    expect(outcome.ok).toBe(true);
    expect(aggregates.progress.knowledge.current).toBe(19);
    expect(aggregates.progress.presence?.coordinates).toEqual({ columnIndex: 5, rowIndex: 6 });
    expect(aggregates.progress.steps).toBe(1);
    expect(aggregates.progress.knowledge.revision).toBe(1);
    expect(outcome.ok && outcome.events.map((e) => e.type)).toEqual([
      'KNOWLEDGE_CHANGED',
      'WILL_SPENT',
    ]);
  });

  it('does not charge in the camp, but still moves the hero', () => {
    const state = run(fresh(), arrive('camping', 3, 3)).aggregates;
    const { aggregates } = run(state, step(0, 3, 4));
    expect(aggregates.progress.knowledge.current).toBe(20);
    expect(aggregates.progress.presence?.coordinates).toEqual({ columnIndex: 3, rowIndex: 4 });
  });

  it.each([
    ['a hex that is not next to him', 5, 8],
    ['the hex he stands on', 5, 5],
  ])('refuses %s and changes nothing', (_name, column, row) => {
    const state = run(fresh(), arrive('silesia', 5, 5)).aggregates;
    const before = structuredClone(state);
    const { outcome } = run(state, step(0, column, row));
    expect(outcome).toMatchObject({ ok: false, code: 'INVALID_STEP' });
    expect(state).toEqual(before);
  });

  it('refuses a step before the server has seen the hero anywhere', () => {
    expect(run(fresh(), step(0, 1, 1)).outcome).toMatchObject({ ok: false, code: 'INVALID_STEP' });
  });

  it('refuses a step with too little Will, with the reason, and leaves the Will alone', () => {
    const start = run(fresh(), arrive('silesia', 5, 5)).aggregates;
    start.progress.knowledge.current = 0;
    const { outcome, aggregates } = run(start, step(0, 5, 6));
    expect(outcome).toMatchObject({ ok: false, code: 'INSUFFICIENT_WILL' });
    expect(aggregates.progress.knowledge.current).toBe(0);
    expect(aggregates.progress.steps).toBe(0);
  });

  it('refuses a stale knowledge revision', () => {
    const state = run(fresh(), arrive('silesia', 5, 5)).aggregates;
    expect(run(state, step(7, 5, 6)).outcome).toMatchObject({ ok: false });
  });

  it('walks a whole path one step at a time and spends exactly its length', () => {
    let state = run(fresh(), arrive('silesia', 5, 5)).aggregates;
    const path: [number, number][] = [
      [5, 6],
      [5, 7],
      [5, 8],
      [5, 9],
    ];
    path.forEach(([column, row], index) => {
      const result = run(state, step(index, column, row));
      expect(result.outcome.ok).toBe(true);
      state = result.aggregates;
    });
    expect(state.progress.knowledge.current).toBe(16);
    expect(state.progress.steps).toBe(4);
  });
});

describe('the Book of Will on the server', () => {
  const nextToBook = getHexNeighbors(CAMP_BOOK_HEX)[0];
  const open = (revision: number) =>
    parse({ type: 'KNOWLEDGE', payload: { heroId: HERO, revision, action: { kind: 'open' } } });

  it('works only next to the camp Book, which the server knows from where the hero stood', () => {
    expect(serverKnowledgeContext(null).atBook).toBe(false);
    const away = run(fresh(), arrive('camping', 1, 1)).aggregates;
    expect(run(away, open(0)).outcome).toMatchObject({ ok: false });
    const near = run(
      fresh(),
      arrive('camping', nextToBook.columnIndex, nextToBook.rowIndex),
    ).aggregates;
    expect(run(near, open(0)).outcome.ok).toBe(true);
  });

  it('is never open in a location that charges Will, even when the hero claims to be at the book', () => {
    const elsewhere = run(
      fresh(),
      arrive('silesia', nextToBook.columnIndex, nextToBook.rowIndex),
    ).aggregates;
    expect(run(elsewhere, open(0)).outcome).toMatchObject({ ok: false });
  });

  it('runs a practice: the server makes the question, a right answer gives Will, a wrong one does not', () => {
    let state = run(
      fresh(),
      arrive('camping', nextToBook.columnIndex, nextToBook.rowIndex),
    ).aggregates;
    state.progress.knowledge.current = 10;
    state = run(
      state,
      parse({
        type: 'KNOWLEDGE',
        payload: {
          heroId: HERO,
          revision: 0,
          action: { kind: 'start', mode: 'hall', seed: 'seed-1' },
        },
      }),
    ).aggregates;
    const session = state.progress.knowledge.session!;
    const answer = (value: number, revision: number) =>
      parse({
        type: 'KNOWLEDGE',
        payload: {
          heroId: HERO,
          revision,
          action: {
            kind: 'answer',
            sessionId: session.id,
            questionId: session.question.id,
            answer: value,
            elapsedMs: 9000,
          },
        },
      });
    const wrong = session.question.options.find((option) => option !== session.question.answer)!;
    const rightResult = run(
      state,
      answer(session.question.answer, state.progress.knowledge.revision),
    );
    expect(rightResult.aggregates.progress.knowledge.current).toBe(11);

    const wrongResult = run(state, answer(wrong, state.progress.knowledge.revision));
    expect(wrongResult.aggregates.progress.knowledge.current).toBe(10);
  });
});

describe('skills on the server', () => {
  const sacrifice = (revision: number) =>
    parse({
      type: 'SACRIFICE_TO_SKILL',
      payload: { heroId: HERO, revision, skillId: 'b_strike', option: 'small' },
    });
  const reset = (revision: number) =>
    parse({ type: 'RESET_SKILLS', payload: { heroId: HERO, revision } });

  it('pours Will into a skill and refuses with too little', () => {
    const state = fresh();
    state.progress.knowledge.current = 30;
    const done = run(state, sacrifice(0));
    expect(done.outcome.ok).toBe(true);
    expect(done.aggregates.progress.knowledge.skills.b_strike).toBe(2);
    expect(done.aggregates.progress.knowledge.current).toBe(15);

    const broke = fresh();
    broke.progress.knowledge.current = 0;
    expect(run(broke, sacrifice(0)).outcome).toMatchObject({ ok: false });
  });

  it('resets skills without refunding the Will', () => {
    const state = fresh();
    state.progress.knowledge.current = 30;
    const done = run(state, sacrifice(0)).aggregates;
    const after = run(done, reset(done.progress.knowledge.revision));
    expect(after.outcome.ok).toBe(true);
    expect(after.aggregates.progress.knowledge.skills).toEqual({});
    expect(after.aggregates.progress.knowledge.current).toBe(15);
  });

  it('refuses a reset when there is nothing to reset', () => {
    expect(run(fresh(), reset(0)).outcome).toMatchObject({ ok: false, code: 'NOTHING_TO_RESET' });
  });
});

describe('SPEND_WILL: the price comes from content and the location, never from the player', () => {
  const spendPortal = (revision: number) =>
    parse({
      type: 'SPEND_WILL',
      payload: {
        heroId: HERO,
        revision,
        spend: { kind: 'portal', target: { columnIndex: 4, rowIndex: 4 } },
      },
    });
  const inSilesia = () => run(fresh(), arrive('silesia', 4, 5)).aggregates;

  it('prices a portal by the Teleport skill alone: refused without it, 10 at rank 1', () => {
    expect(run(inSilesia(), spendPortal(0)).outcome).toMatchObject({
      ok: false,
      code: 'NOT_AN_ANGEL',
    });
    const angel = inSilesia();
    angel.progress.knowledge.skills = { a_crest: 1, a_teleport: 1 };
    const lying = PLAYER_COMMAND_SCHEMAS.SPEND_WILL.parse({
      type: 'SPEND_WILL',
      payload: {
        heroId: HERO,
        revision: 0,
        spend: { kind: 'portal', target: { columnIndex: 4, rowIndex: 4 }, cost: 0 },
      },
    }) as PlayerCommand;
    const { aggregates } = run(angel, lying);
    expect(aggregates.progress.knowledge.current).toBe(10);
    const camp = run(fresh(), arrive('camping', 4, 5)).aggregates;
    camp.progress.knowledge.skills = { a_crest: 1, a_teleport: 1 };
    expect(run(camp, spendPortal(0)).outcome).toMatchObject({ ok: false, code: 'IN_CAMPING' });
  });
});

describe('dev Will fixtures', () => {
  const grant = (revision: number, amount: number) =>
    parse({ type: 'DEV_GRANT_WILL', payload: { heroId: HERO, revision, amount } });

  it('are forbidden unless allowed, and grant only up to the capacity', () => {
    expect(run(fresh(), grant(0, 5)).outcome).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    const allowed = executePlayerCommand(fresh(), grant(0, 500), { ...CTX, devGrantAllowed: true });
    if (!allowed.ok) throw new Error(allowed.code);
    expect(allowed.changed.progress!.knowledge.current).toBe(50);
  });

  it('replace the whole knowledge for a fixture, keeping the hero id and moving the revision on', () => {
    const knowledge = { ...fresh().progress.knowledge, current: 7, skills: { b_strike: 3 } };
    const outcome = executePlayerCommand(
      fresh(),
      parse({
        type: 'DEV_SET_KNOWLEDGE',
        payload: { heroId: HERO, revision: 0, knowledge: { ...knowledge, heroId: 'someone-else' } },
      }),
      { ...CTX, devGrantAllowed: true },
    );
    if (!outcome.ok) throw new Error(outcome.code);
    expect(outcome.changed.progress!.knowledge).toMatchObject({
      heroId: HERO,
      current: 7,
      revision: 1,
    });
  });
});
