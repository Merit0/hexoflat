import { describe, expect, it } from 'vitest';
import { heroBotAction } from './battle-sim';
import { projectBattleForViewer } from './projection';
import { applyCommand, type HexEngineState } from '../commands/apply-command';
import { createContext } from '../commands/command-test-context';
import { deserializeState, serializeState } from '../commands/snapshot';
import type { DomainEvent } from '../commands/types';
import { HexMapBuilder } from '../map/builders/hex-map-builder';
import { BATTLE_RULES } from './battle-content';
import type { BattleAction } from './battle-commands';
import type { BattleState } from './battle-state';
import {
  battleWith,
  enemyTurn,
  eventTypes,
  giveTurn,
  hero,
  heroDoes,
  rejectionOf,
  skeleton,
} from './battle-test-setup';
import { applyBattleCommand } from './apply-battle';

function duel(): BattleState {
  return giveTurn(battleWith([hero({ q: 0, r: 0 }), skeleton('s1', { q: 2, r: 0 })]), [
    'hero',
    's1',
  ]);
}

function play(battle: BattleState, script: (BattleAction | 'enemy')[]) {
  const events: DomainEvent[] = [];
  let state = battle;
  for (const step of script) {
    const result = step === 'enemy' ? enemyTurn(state) : heroDoes(state, step);
    state = result.battle;
    events.push(...result.events);
  }
  return { battle: state, events };
}

describe('enemy turn', () => {
  it('walks up, strikes and hands the turn to the defender for the block window', () => {
    const start = giveTurn(battleWith([hero({ q: 0, r: 0 }), skeleton('s1', { q: 3, r: 0 })]), [
      's1',
      'hero',
    ]);
    const { battle, events } = enemyTurn(start);
    expect(eventTypes(events)).toEqual(['STRIKE_DEALT', 'REACTION_OPENED']);
    expect(battle.creatures[1].pos).toEqual({ q: 3, r: 0 });
    expect(battle.activeId).toBe('hero');
    expect(battle.phase).toBe('defend');
    expect(battle.pending).toHaveLength(1);
    expect(battle.reaction).toMatchObject({ stage: 'block', attackerId: 's1', defenderId: 'hero' });
    const guess = heroBotAction(projectBattleForViewer(battle, 'heroes'), BATTLE_RULES);
    expect(guess).toMatchObject({ kind: 'place-shield' });
  });

  it('refuses to run when a hero holds the turn', () => {
    expect(rejectionOf(enemyTurn(duel()).events)).toBe('NOT_YOUR_TURN');
  });
});

describe('REQ-BTL-014 end of battle', () => {
  it('wins when the last enemy falls and clears shields, stance and Will', () => {
    const start = duel();
    start.creatures[1].hp = 2;
    const { battle, events } = play(start, [
      { kind: 'move', hex: { q: 1, r: 0 } },
      { kind: 'strike', targetId: 's1', hand: 'right' },
      { kind: 'end-turn' },
      'enemy',
    ]);
    expect(battle.phase).toBe('ended');
    expect(battle.outcome).toBe('victory');
    expect(battle.stance).toEqual({});
    expect(battle.turnWill).toBe(0);
    const ended = events.find((e) => e.type === 'BATTLE_ENDED')!.payload;
    expect(ended).toMatchObject({ outcome: 'victory', kills: 1, heroes: [{ id: 'hero', hp: 6 }] });
    expect(rejectionOf(heroDoes(battle, { kind: 'end-turn' }).events)).toBe('BATTLE_ENDED');
  });

  it('loses when the last hero falls and keeps the hearts as they are', () => {
    const start = giveTurn(
      battleWith([hero({ q: 0, r: 0 }, { hp: 1 }), skeleton('s1', { q: 1, r: 0 })]),
      ['s1', 'hero'],
    );
    const { battle, events } = play(start, ['enemy', { kind: 'take-hit' }]);
    expect(battle.outcome).toBe('defeat');
    expect(eventTypes(events)).toContain('CREATURE_FELL');
    expect(events.at(-1)!.payload).toMatchObject({
      outcome: 'defeat',
      heroes: [{ id: 'hero', hp: 0 }],
    });
  });

  it('never touches the hero Will stock outside battle', () => {
    const map = new HexMapBuilder().name('battle-host').width(2).height(2).build();
    const knowledge = { current: 17 } as HexEngineState['knowledge'];
    const state: HexEngineState = { map, heroes: {}, knowledge, battle: duel() };
    applyCommand(
      state,
      {
        type: 'BATTLE',
        payload: { kind: 'hero', heroId: 'hero', atMs: 0, action: { kind: 'end-turn' } },
      },
      createContext(),
    );
    expect(state.knowledge).toBe(knowledge);
    expect(state.knowledge!.current).toBe(17);
    expect(state.battle!.stance.hero).toBe(BATTLE_RULES.stanceMax);
  });

  it('says there is no battle when none is running', () => {
    const result = applyBattleCommand(undefined, {
      type: 'BATTLE',
      payload: { kind: 'run-enemy-turn', atMs: 0 },
    });
    expect(rejectionOf(result.events)).toBe('NO_BATTLE');
  });
});

describe('REQ-BTL-015 replay', () => {
  const script: (BattleAction | 'enemy')[] = [
    { kind: 'end-turn' },
    'enemy',
    { kind: 'place-shield', hex: { q: 1, r: 0 } },
    { kind: 'reaction-timeout' },
    { kind: 'end-turn' },
  ];

  it('gives the same events for the same seed and commands', () => {
    const run = () => {
      const start = battleWith(
        [hero({ q: -2, r: 0 }), skeleton('s1', { q: 2, r: 0 })],
        undefined,
        'replay',
      );
      const order = start.order;
      const first = order[0] === 'hero' ? script : ['enemy' as const, ...script.slice(1)];
      return play(start, first).events;
    };
    expect(run()).toEqual(run());
  });

  it('survives a snapshot round trip mid-battle', () => {
    const map = new HexMapBuilder().name('battle-host').width(2).height(2).build();
    const battle = heroDoes(duel(), { kind: 'move', hex: { q: 1, r: 0 } }).battle;
    const restored = deserializeState(serializeState({ map, heroes: {}, battle }), 0);
    expect(restored.battle).toEqual(battle);
    const old = serializeState({ map, heroes: {} });
    expect(deserializeState(old, 0).battle).toBeUndefined();
  });
});
