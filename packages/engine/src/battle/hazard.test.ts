import { describe, expect, it } from 'vitest';
import { BATTLE_RULES } from './battle-content';
import type { BattleState } from './battle-state';
import {
  battleWith,
  enemyTurn,
  eventTypes,
  giveTurn,
  hero,
  heroDoes,
  hexagonBoard,
  rightAnswer,
  skeleton,
  wrongAnswer,
} from './battle-test-setup';
import { findDisplaceable, resolvePush } from './displacement';
import { sawDamage, throwClearOfSaw } from './hazard';

const T0 = 5_000;

function heroBesideSaw(hp = 6): BattleState {
  return giveTurn(
    battleWith(
      [hero({ q: 0, r: 0 }, { hp }), skeleton('s1', { q: -3, r: 0 })],
      hexagonBoard(3, { '1,0': 'saw' }),
    ),
    ['hero', 's1'],
  );
}

function stepOnSaw(hp = 6) {
  return heroDoes(heroBesideSaw(hp), { kind: 'move', hex: { q: 1, r: 0 } }, 'hero', T0);
}

describe('REQ-BTL-009 saw', () => {
  it('takes half of the current hearts, rounded up to half a heart, at least half a heart', () => {
    expect(sawDamage(6)).toBe(3);
    expect(sawDamage(5)).toBe(3);
    expect(sawDamage(2)).toBe(1);
    expect(sawDamage(1)).toBe(1);
  });

  it('opens a task when the hero steps onto the saw and forgets the undo', () => {
    const { battle, events } = stepOnSaw();
    expect(eventTypes(events)).toEqual(['CREATURE_MOVED', 'HAZARD_TRIGGERED', 'TASK_ISSUED']);
    expect(battle.task!.kind).toBe('saw');
    expect(battle.undo).toEqual([]);
  });

  it('a right answer spares the hero and throws the hero back to the hex the hero came from', () => {
    const opened = stepOnSaw().battle;
    const { battle } = heroDoes(
      opened,
      { kind: 'answer-task', option: rightAnswer(opened) },
      'hero',
      T0 + 1,
    );
    expect(battle.creatures[0].hp).toBe(6);
    expect(battle.creatures[0].pos).toEqual({ q: 0, r: 0 });
    expect(battle.phase).toBe('act');
    expect(battle.activeId).toBe('hero');
  });

  it('a wrong or late answer hurts, then throws the hero clear', () => {
    const opened = stepOnSaw(5).battle;
    const wrong = heroDoes(
      opened,
      { kind: 'answer-task', option: wrongAnswer(opened) },
      'hero',
      T0,
    );
    expect(wrong.battle.creatures[0].hp).toBe(2);
    expect(wrong.battle.creatures[0].pos).toEqual({ q: 0, r: 0 });
    const late = heroDoes(opened, { kind: 'task-timeout' }, 'hero', T0 + BATTLE_RULES.taskMs);
    expect(late.battle.creatures[0].hp).toBe(2);
  });

  it('kills a hero who cannot survive the cut', () => {
    const opened = stepOnSaw(1).battle;
    const { battle, events } = heroDoes(opened, { kind: 'task-timeout' }, 'hero', T0 + 9_000);
    expect(battle.creatures[0].hp).toBe(0);
    expect(battle.outcome).toBe('defeat');
    expect(eventTypes(events)).toContain('CREATURE_FELL');
  });
});

describe('REQ-BTL-009 saw: pushed onto it', () => {
  it('throws to the free side farthest from the pusher when the way back is taken', () => {
    const battle = giveTurn(
      battleWith(
        [hero({ q: 1, r: 0 }), skeleton('k', { q: 0, r: 0 })],
        hexagonBoard(3, { '1,0': 'saw', '2,-1': 'wall', '1,1': 'wall' }),
      ),
      ['k', 'hero'],
    );
    const events = throwClearOfSaw(battle, battle.creatures[0], { q: 0, r: 0 }, { q: 0, r: 0 });
    expect(battle.creatures[0].pos).toEqual({ q: 2, r: 0 });
    expect(eventTypes(events)).toEqual(['THROWN_CLEAR']);
  });

  it('hurts an enemy pushed onto the saw at once, without a task', () => {
    const battle = giveTurn(
      battleWith(
        [hero({ q: 0, r: 0 }), skeleton('s1', { q: 1, r: 0 }, { hp: 3 })],
        hexagonBoard(3, { '2,0': 'saw' }),
      ),
      ['hero', 's1'],
    );
    const opened = heroDoes(battle, { kind: 'push', targetId: 's1' }, 'hero', T0).battle;
    const { battle: after, events } = heroDoes(
      opened,
      { kind: 'answer-task', option: rightAnswer(opened) },
      'hero',
      T0 + 100,
    );
    expect(after.creatures[1].hp).toBe(1);
    expect(after.task).toBeUndefined();
    expect(eventTypes(events)).toEqual([
      'TASK_RESOLVED',
      'DISPLACED',
      'HAZARD_TRIGGERED',
      'CREATURE_DAMAGED',
      'THROWN_CLEAR',
    ]);
    expect(after.creatures[1].pos).not.toEqual({ q: 2, r: 0 });
  });

  it('opens a task for a hero an enemy pushes onto the saw, and the enemy turn waits for it', () => {
    const battle = giveTurn(
      battleWith(
        [hero({ q: 1, r: 0 }), skeleton('k', { q: 0, r: 0 }, { force: 2 })],
        hexagonBoard(3, { '2,0': 'saw' }),
      ),
      ['k', 'hero'],
    );
    const events = resolvePush(
      battle,
      battle.creatures[1],
      findDisplaceable(battle, 'hero', BATTLE_RULES)!,
      T0,
      BATTLE_RULES,
    );
    expect(eventTypes(events)).toEqual(['DISPLACED', 'HAZARD_TRIGGERED', 'TASK_ISSUED']);
    expect(battle.task).toMatchObject({ kind: 'saw', creatureId: 'hero' });
    const answered = heroDoes(
      battle,
      { kind: 'answer-task', option: rightAnswer(battle) },
      'hero',
      T0,
    );
    expect(answered.battle.creatures[0].pos).toEqual({ q: 1, r: 0 });
    expect(answered.battle.activeId).toBe('k');
  });

  it('never routes an enemy over the saw', () => {
    const battle = giveTurn(
      battleWith(
        [hero({ q: 2, r: 0 }), skeleton('s1', { q: -1, r: 0 })],
        hexagonBoard(3, { '0,0': 'saw' }),
      ),
      ['s1', 'hero'],
    );
    const opened = enemyTurn(battle);
    const landed = heroDoes(opened.battle, { kind: 'take-hit' });
    const events = [...opened.events, ...landed.events];
    const steps = events.filter((e) => e.type === 'CREATURE_MOVED');
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps)
      expect((step.payload as { to: unknown }).to).not.toEqual({ q: 0, r: 0 });
    expect(eventTypes(events)).not.toContain('HAZARD_TRIGGERED');
  });
});
