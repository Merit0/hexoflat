import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  type HexEngineActionContext,
  type HexEngineState,
} from '../commands/apply-command';
import { HexMapBuilder } from '../map/builders/hex-map-builder';
import { createKnowledgeState, knowledgeStateSchema } from '../knowledge/state';
import type { KnowledgeContext } from '../knowledge/commands';
import type { SkillId } from './skill-content';

function stateFixture(will: number, context: Partial<KnowledgeContext> = {}): HexEngineState {
  const knowledge = createKnowledgeState('hero');
  knowledge.current = will;
  return {
    map: new HexMapBuilder().name('camp').width(2).height(2).build(),
    heroes: {},
    knowledge,
    knowledgeContext: {
      locationKey: 'camping',
      willZone: 'free',
      mapId: 'camp',
      combatActive: false,
      moving: false,
      atBook: false,
      ...context,
    },
  };
}

function unlock(state: HexEngineState, skillId: SkillId, revision = state.knowledge!.revision) {
  return applyCommand(
    state,
    { type: 'UNLOCK_SKILL', payload: { heroId: 'hero', revision, skillId } },
    {} as HexEngineActionContext,
  );
}

describe('UNLOCK_SKILL', () => {
  it('spends Will, raises the rank and emits unlock and spend events', () => {
    const state = stateFixture(30);
    const { events } = unlock(state, 'b_strike');

    expect(state.knowledge!.skills.b_strike).toBe(1);
    expect(state.knowledge!.current).toBe(24);
    expect(state.knowledge!.revision).toBe(1);
    expect(events.map((event) => event.type)).toEqual(['SKILL_UNLOCKED', 'WILL_SPENT']);
    expect(events[0].payload).toMatchObject({ skillId: 'b_strike', rank: 1, cost: 6, revision: 1 });
    expect(events[1].payload).toMatchObject({ reason: 'skill', ref: 'b_strike', balanceAfter: 24 });
  });

  it('charges the price of the next rank', () => {
    const state = stateFixture(50);
    state.knowledge!.skills.b_guard = 2;
    const { events } = unlock(state, 'b_guard');

    expect(state.knowledge!.skills.b_guard).toBe(3);
    expect(events[0].payload).toMatchObject({ rank: 3, cost: 8 });
    expect(state.knowledge!.current).toBe(42);
  });

  it('rejects without changing state when Will is not enough', () => {
    const state = stateFixture(5);
    const { events } = unlock(state, 'b_strike');

    expect(events.map((event) => event.type)).toEqual(['SKILL_REJECTED', 'WILL_REJECTED']);
    expect(events[0].payload).toMatchObject({ reason: 'INSUFFICIENT_WILL' });
    expect(state.knowledge!.current).toBe(5);
    expect(state.knowledge!.skills.b_strike).toBeUndefined();
    expect(state.knowledge!.revision).toBe(0);
  });

  it('rejects a stale revision and the wrong hero', () => {
    const state = stateFixture(50);
    expect(unlock(state, 'b_strike', 5).events[0].payload).toMatchObject({
      reason: 'STALE_REVISION',
    });
    const wrongHero = applyCommand(
      state,
      { type: 'UNLOCK_SKILL', payload: { heroId: 'other', revision: 0, skillId: 'b_strike' } },
      {} as HexEngineActionContext,
    );
    expect(wrongHero.events[0].payload).toMatchObject({ reason: 'WRONG_HERO' });
    expect(state.knowledge!.current).toBe(50);
  });

  it('rejects during combat and while moving', () => {
    const inCombat = stateFixture(50, { combatActive: true });
    expect(unlock(inCombat, 'b_strike').events[0].payload).toMatchObject({ reason: 'IN_COMBAT' });
    const moving = stateFixture(50, { moving: true });
    expect(unlock(moving, 'b_strike').events[0].payload).toMatchObject({ reason: 'MOVING' });
    expect(inCombat.knowledge!.current).toBe(50);
  });

  it('rejects once the top rank is reached', () => {
    const state = stateFixture(50);
    state.knowledge!.skills.b_strike = 10;
    const { events } = unlock(state, 'b_strike');

    expect(events[0].payload).toMatchObject({ reason: 'MAX_RANK' });
    expect(state.knowledge!.current).toBe(50);
  });

  it('rejects when there is no authoritative Will state', () => {
    const state = stateFixture(50);
    delete state.knowledge;
    expect(unlock(state, 'b_strike', 0).events[0].type).toBe('SKILL_REJECTED');
  });

  it('rejects an unknown skill id at the schema', () => {
    const state = stateFixture(50);
    expect(() =>
      applyCommand(
        state,
        {
          type: 'UNLOCK_SKILL',
          payload: { heroId: 'hero', revision: 0, skillId: 'luck' as SkillId },
        },
        {} as HexEngineActionContext,
      ),
    ).toThrow();
  });
});

describe('UNLOCK_SKILL tree rules', () => {
  it('refuses a skill that is not implemented yet and keeps state', () => {
    const state = stateFixture(50);
    state.knowledge!.skills.b_strike = 1;
    const { events } = unlock(state, 'b_heavy');
    expect(events).toHaveLength(1);
    expect(events[0].payload).toMatchObject({ reason: 'NOT_AVAILABLE_YET' });
    expect(state.knowledge!.current).toBe(50);
  });

  it('refuses a skill whose parent is not unlocked', () => {
    const state = stateFixture(50);
    const { events } = unlock(state, 'a_gate');
    expect(events[0].payload).toMatchObject({ reason: 'REQUIREMENTS_NOT_MET' });
    expect(state.knowledge!.current).toBe(50);
    expect(state.knowledge!.skills.a_gate).toBeUndefined();
  });

  it('treats the free bionic crest as already unlocked', () => {
    const state = stateFixture(50);
    expect(unlock(state, 'b_crest').events[0].payload).toMatchObject({ reason: 'MAX_RANK' });
    expect(unlock(state, 'b_strike').events[0].type).toBe('SKILL_UNLOCKED');
  });

  it('walks a_crest to a_gate rank 3 charging each rank price', () => {
    const state = stateFixture(50);
    const spent: number[] = [];
    for (const id of ['a_crest', 'a_gate', 'a_gate', 'a_gate'] as const) {
      const before = state.knowledge!.current;
      state.knowledge!.current = 50;
      expect(unlock(state, id).events[0].type).toBe('SKILL_UNLOCKED');
      spent.push(50 - state.knowledge!.current);
      state.knowledge!.current = before;
    }
    expect(spent).toEqual([10, 12, 12, 15]);
    expect(state.knowledge!.skills).toMatchObject({ a_crest: 1, a_gate: 3 });
  });
});

describe('knowledge state skills field', () => {
  it('loads a save written before skills existed with no ranks', () => {
    const legacy = {
      version: 1,
      heroId: 'hero',
      revision: 3,
      current: 12,
      capacity: 50,
      sequence: 0,
      session: null,
      lastStep: null,
      history: {},
    };
    const parsed = knowledgeStateSchema.parse(legacy);
    expect(parsed).toMatchObject({ revision: 3, current: 12, skills: {} });
  });

  it('migrates legacy attack/defense ranks to the bionic nodes', () => {
    const legacy = { ...createKnowledgeState('hero'), skills: { attack: 7, defense: 1, luck: 3 } };
    expect(knowledgeStateSchema.parse(legacy)).toMatchObject({
      skills: { b_strike: 7, b_guard: 1 },
    });
  });

  it('keeps the larger rank when a legacy key and its new key both exist', () => {
    const legacy = { ...createKnowledgeState('hero'), skills: { attack: 2, b_strike: 5 } };
    expect(knowledgeStateSchema.parse(legacy).skills).toEqual({ b_strike: 5 });
  });

  it('keeps unlocked ranks through a parse round trip', () => {
    const state = createKnowledgeState('hero');
    state.skills.b_guard = 4;
    expect(knowledgeStateSchema.parse(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });
});
