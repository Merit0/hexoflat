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
    const { events } = unlock(state, 'attack');

    expect(state.knowledge!.skills.attack).toBe(1);
    expect(state.knowledge!.current).toBe(10);
    expect(state.knowledge!.revision).toBe(1);
    expect(events.map((event) => event.type)).toEqual(['SKILL_UNLOCKED', 'WILL_SPENT']);
    expect(events[0].payload).toMatchObject({ skillId: 'attack', rank: 1, cost: 20, revision: 1 });
    expect(events[1].payload).toMatchObject({ reason: 'skill', ref: 'attack', balanceAfter: 10 });
  });

  it('charges the price of the next rank', () => {
    const state = stateFixture(50);
    state.knowledge!.skills.defense = 2;
    const { events } = unlock(state, 'defense');

    expect(state.knowledge!.skills.defense).toBe(3);
    expect(events[0].payload).toMatchObject({ rank: 3, cost: 25 });
    expect(state.knowledge!.current).toBe(25);
  });

  it('rejects without changing state when Will is not enough', () => {
    const state = stateFixture(19);
    const { events } = unlock(state, 'attack');

    expect(events.map((event) => event.type)).toEqual(['SKILL_REJECTED', 'WILL_REJECTED']);
    expect(events[0].payload).toMatchObject({ reason: 'INSUFFICIENT_WILL' });
    expect(state.knowledge!.current).toBe(19);
    expect(state.knowledge!.skills.attack).toBeUndefined();
    expect(state.knowledge!.revision).toBe(0);
  });

  it('rejects a stale revision and the wrong hero', () => {
    const state = stateFixture(50);
    expect(unlock(state, 'attack', 5).events[0].payload).toMatchObject({
      reason: 'STALE_REVISION',
    });
    const wrongHero = applyCommand(
      state,
      { type: 'UNLOCK_SKILL', payload: { heroId: 'other', revision: 0, skillId: 'attack' } },
      {} as HexEngineActionContext,
    );
    expect(wrongHero.events[0].payload).toMatchObject({ reason: 'WRONG_HERO' });
    expect(state.knowledge!.current).toBe(50);
  });

  it('rejects during combat and while moving', () => {
    const inCombat = stateFixture(50, { combatActive: true });
    expect(unlock(inCombat, 'attack').events[0].payload).toMatchObject({ reason: 'IN_COMBAT' });
    const moving = stateFixture(50, { moving: true });
    expect(unlock(moving, 'attack').events[0].payload).toMatchObject({ reason: 'MOVING' });
    expect(inCombat.knowledge!.current).toBe(50);
  });

  it('rejects once the top rank is reached', () => {
    const state = stateFixture(50);
    state.knowledge!.skills.attack = 10;
    const { events } = unlock(state, 'attack');

    expect(events[0].payload).toMatchObject({ reason: 'MAX_RANK' });
    expect(state.knowledge!.current).toBe(50);
  });

  it('rejects when there is no authoritative Will state', () => {
    const state = stateFixture(50);
    delete state.knowledge;
    expect(unlock(state, 'attack', 0).events[0].type).toBe('SKILL_REJECTED');
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

  it('keeps unlocked ranks through a parse round trip', () => {
    const state = createKnowledgeState('hero');
    state.skills.defense = 4;
    expect(knowledgeStateSchema.parse(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });
});
