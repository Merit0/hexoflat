import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  type HexEngineActionContext,
  type HexEngineState,
} from '../commands/apply-command';
import { HexMapBuilder } from '../map/builders/hex-map-builder';
import { createKnowledgeState, knowledgeStateSchema } from '../knowledge/state';
import type { KnowledgeContext } from '../knowledge/commands';
import type { SacrificeOptionId } from './sacrifice-rules';
import type { SkillId } from './skill-content';

function stateFixture(
  will: number,
  context: Partial<KnowledgeContext> = {},
  capacity = 50,
): HexEngineState {
  const knowledge = createKnowledgeState('hero');
  knowledge.capacity = capacity;
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

function sacrifice(
  state: HexEngineState,
  skillId: SkillId,
  option: SacrificeOptionId = 'small',
  revision = state.knowledge!.revision,
) {
  return applyCommand(
    state,
    { type: 'SACRIFICE_TO_SKILL', payload: { heroId: 'hero', revision, skillId, option } },
    {} as HexEngineActionContext,
  );
}

describe('SACRIFICE_TO_SKILL', () => {
  it('pours Will into the bar, raises the rank when the price is met and emits events', () => {
    const state = stateFixture(30);
    const { events } = sacrifice(state, 'b_strike', 'small');

    expect(state.knowledge!.skills.b_strike).toBe(2);
    expect(state.knowledge!.skillProgress.b_strike).toBe(3);
    expect(state.knowledge!.current).toBe(15);
    expect(state.knowledge!.revision).toBe(1);
    expect(events.map((event) => event.type)).toEqual(['SKILL_SACRIFICED', 'WILL_SPENT']);
    expect(events[0].payload).toMatchObject({
      skillId: 'b_strike',
      option: 'small',
      amount: 15,
      rank: 2,
      progress: 3,
      ranksGained: 2,
      revision: 1,
    });
    expect(events[1].payload).toMatchObject({ reason: 'skill', ref: 'b_strike', balanceAfter: 15 });
  });

  it('keeps partial progress on an expensive skill without raising the rank', () => {
    const state = stateFixture(50);
    state.knowledge!.skills.a_crest = 1;
    const { events } = sacrifice(state, 'a_teleport', 'medium');

    expect(state.knowledge!.skills.a_teleport ?? 0).toBe(0);
    expect(state.knowledge!.skillProgress.a_teleport).toBe(30);
    expect(state.knowledge!.current).toBe(20);
    expect(events[0].payload).toMatchObject({ rank: 0, progress: 30, ranksGained: 0 });
  });

  it('adds up across several sacrifices until the rank is reached', () => {
    const state = stateFixture(100, {}, 100);
    state.knowledge!.skills.a_crest = 1;
    for (let i = 0; i < 5; i++) {
      state.knowledge!.current = 100;
      sacrifice(state, 'a_teleport', 'all');
    }
    expect(state.knowledge!.skills.a_teleport).toBe(1);
    expect(state.knowledge!.skillProgress.a_teleport).toBe(0);
  });

  it('"all" sacrifices exactly what the hero holds, however little', () => {
    const state = stateFixture(4);
    const { events } = sacrifice(state, 'b_strike', 'all');
    expect(state.knowledge!.current).toBe(0);
    expect(events[0].payload).toMatchObject({ amount: 4, rank: 0, progress: 4 });
  });

  it('scales the options by capacity: a capacity-100 hero offers 30 / 60 / 100', () => {
    const state = stateFixture(100, {}, 100);
    state.knowledge!.skills.a_crest = 1;
    const { events } = sacrifice(state, 'a_teleport', 'medium');
    expect(events[0].payload).toMatchObject({ amount: 60, progress: 60 });
    expect(state.knowledge!.current).toBe(40);
  });
});

describe('SACRIFICE_TO_SKILL refusals', () => {
  it('rejects an option the hero cannot afford and changes nothing', () => {
    const state = stateFixture(20);
    const { events } = sacrifice(state, 'b_strike', 'medium');

    expect(events.map((event) => event.type)).toEqual(['SKILL_REJECTED', 'WILL_REJECTED']);
    expect(events[0].payload).toMatchObject({ reason: 'INSUFFICIENT_WILL' });
    expect(state.knowledge!.current).toBe(20);
    expect(state.knowledge!.skills.b_strike).toBeUndefined();
    expect(state.knowledge!.skillProgress.b_strike).toBeUndefined();
    expect(state.knowledge!.revision).toBe(0);
  });

  it('rejects "all" with no Will at all', () => {
    const state = stateFixture(0);
    expect(sacrifice(state, 'b_strike', 'all').events[0].payload).toMatchObject({
      reason: 'INSUFFICIENT_WILL',
    });
  });

  it('rejects a stale revision and the wrong hero', () => {
    const state = stateFixture(50);
    expect(sacrifice(state, 'b_strike', 'small', 5).events[0].payload).toMatchObject({
      reason: 'STALE_REVISION',
    });
    const wrongHero = applyCommand(
      state,
      {
        type: 'SACRIFICE_TO_SKILL',
        payload: { heroId: 'other', revision: 0, skillId: 'b_strike', option: 'small' },
      },
      {} as HexEngineActionContext,
    );
    expect(wrongHero.events[0].payload).toMatchObject({ reason: 'WRONG_HERO' });
    expect(state.knowledge!.current).toBe(50);
  });

  it('rejects during combat and while moving', () => {
    const inCombat = stateFixture(50, { combatActive: true });
    expect(sacrifice(inCombat, 'b_strike').events[0].payload).toMatchObject({
      reason: 'IN_COMBAT',
    });
    const moving = stateFixture(50, { moving: true });
    expect(sacrifice(moving, 'b_strike').events[0].payload).toMatchObject({ reason: 'MOVING' });
    expect(inCombat.knowledge!.current).toBe(50);
  });

  it('rejects once the top rank is reached and a free crest', () => {
    const state = stateFixture(50);
    state.knowledge!.skills.b_strike = 10;
    expect(sacrifice(state, 'b_strike').events[0].payload).toMatchObject({ reason: 'MAX_RANK' });
    expect(sacrifice(state, 'b_crest').events[0].payload).toMatchObject({ reason: 'MAX_RANK' });
    expect(state.knowledge!.current).toBe(50);
  });

  it('takes only what is needed to finish the top rank', () => {
    const state = stateFixture(50);
    state.knowledge!.skills.b_strike = 9;
    state.knowledge!.skillProgress.b_strike = 10;
    const { events } = sacrifice(state, 'b_strike', 'all');
    expect(events[0].payload).toMatchObject({ amount: 8, rank: 10, progress: 0 });
    expect(state.knowledge!.current).toBe(42);
  });

  it('refuses a skill that is not implemented yet or whose parent is locked', () => {
    const state = stateFixture(50);
    state.knowledge!.skills.b_strike = 1;
    expect(sacrifice(state, 'b_heavy').events[0].payload).toMatchObject({
      reason: 'NOT_AVAILABLE_YET',
    });
    expect(sacrifice(state, 'a_teleport').events[0].payload).toMatchObject({
      reason: 'REQUIREMENTS_NOT_MET',
    });
    expect(state.knowledge!.current).toBe(50);
  });

  it('rejects when there is no authoritative Will state', () => {
    const state = stateFixture(50);
    delete state.knowledge;
    expect(sacrifice(state, 'b_strike', 'small', 0).events[0].type).toBe('SKILL_REJECTED');
  });

  it('rejects an unknown skill id or option at the schema', () => {
    const state = stateFixture(50);
    const run = (skillId: string, option: string) => () =>
      applyCommand(
        state,
        {
          type: 'SACRIFICE_TO_SKILL',
          payload: { heroId: 'hero', revision: 0, skillId, option } as never,
        },
        {} as HexEngineActionContext,
      );
    expect(run('luck', 'small')).toThrow();
    expect(run('b_strike', 'half')).toThrow();
  });
});

describe('knowledge state skill progress', () => {
  it('loads a save written before progress existed with an empty bar', () => {
    const legacy: Record<string, unknown> = { ...createKnowledgeState('hero') };
    delete legacy.skillProgress;
    expect(knowledgeStateSchema.parse(legacy)).toMatchObject({ skillProgress: {} });
  });

  it('keeps progress through a parse round trip', () => {
    const state = createKnowledgeState('hero');
    state.skills.a_crest = 1;
    state.skillProgress.a_teleport = 120;
    expect(knowledgeStateSchema.parse(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it('rejects progress that already covers the rank price', () => {
    const state = createKnowledgeState('hero');
    state.skillProgress.b_strike = 6;
    expect(knowledgeStateSchema.safeParse(state).success).toBe(false);
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
});

describe('RESET_SKILLS', () => {
  const reset = (state: HexEngineState, revision = state.knowledge!.revision) =>
    applyCommand(
      state,
      { type: 'RESET_SKILLS', payload: { heroId: 'hero', revision } },
      {} as HexEngineActionContext,
    );

  it('clears every rank and bar, keeps the free crest and does not refund Will', () => {
    const state = stateFixture(20);
    state.knowledge!.skills = { b_strike: 4, b_guard: 2, a_crest: 1 };
    state.knowledge!.skillProgress = { a_teleport: 120 };
    const { events } = reset(state);

    expect(state.knowledge!.skills).toEqual({});
    expect(state.knowledge!.skillProgress).toEqual({});
    expect(state.knowledge!.current).toBe(20);
    expect(state.knowledge!.revision).toBe(1);
    expect(events.map((event) => event.type)).toEqual(['SKILLS_RESET']);
  });

  it('refuses when there is nothing to reset', () => {
    const state = stateFixture(20);
    expect(reset(state).events[0].payload).toMatchObject({ reason: 'NOTHING_TO_RESET' });
    expect(state.knowledge!.revision).toBe(0);
  });

  it('refuses a stale revision, combat and movement without changing anything', () => {
    const state = stateFixture(20);
    state.knowledge!.skills = { b_strike: 1 };
    expect(reset(state, 9).events[0].payload).toMatchObject({ reason: 'STALE_REVISION' });
    const busy = stateFixture(20, { combatActive: true });
    busy.knowledge!.skills = { b_strike: 1 };
    expect(reset(busy).events[0].payload).toMatchObject({ reason: 'IN_COMBAT' });
    expect(busy.knowledge!.skills).toEqual({ b_strike: 1 });
    expect(state.knowledge!.skills).toEqual({ b_strike: 1 });
  });
});
