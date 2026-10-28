import { describe, expect, it } from 'vitest';
import { BATTLE_RULES } from './battle-content';
import type { BattleState } from './battle-state';
import {
  battleWith,
  enemyTurn,
  giveTurn,
  hero,
  heroDoes,
  rejectionOf,
  rightAnswer,
  skeleton,
  wrongAnswer,
} from './battle-test-setup';
import { projectBattleForViewer } from './projection';
import { beginTurn } from './turn';
import { taskOptions } from './timed-task';
import { createSeededRandom } from '../utils/random-seeded';

const T0 = 10_000;

function heroHitTwice(): BattleState {
  const battle = giveTurn(battleWith([hero({ q: 0, r: 0 }), skeleton('s1', { q: 3, r: 0 })]), [
    'hero',
    's1',
  ]);
  battle.pending = [
    {
      id: 'p0',
      attackerId: 's1',
      targetId: 'hero',
      fromHex: { q: 1, r: 0 },
      ring: [{ q: 1, r: 0 }],
      power: 2,
    },
    {
      id: 'p1',
      attackerId: 's1',
      targetId: 'hero',
      fromHex: { q: 0, r: 1 },
      ring: [{ q: 0, r: 1 }],
      power: 1,
    },
  ];
  beginTurn(battle, 'hero', BATTLE_RULES);
  return battle;
}

function dodging(): BattleState {
  return heroDoes(heroHitTwice(), { kind: 'start-dodge' }, 'hero', T0).battle;
}

describe('timed task', () => {
  it('opens a task with four distinct positive options and a 5 s deadline', () => {
    const { battle, events } = heroDoes(heroHitTwice(), { kind: 'start-dodge' }, 'hero', T0);
    const task = battle.task!;
    expect(task.kind).toBe('dodge');
    expect(task.deadlineMs).toBe(T0 + BATTLE_RULES.taskMs);
    expect(new Set(task.options).size).toBe(4);
    expect(task.options.every((o) => o > 0)).toBe(true);
    expect(task.options).toContain(task.answer);
    expect(events.map((e) => e.type)).toEqual(['DODGE_STARTED', 'TASK_ISSUED']);
  });

  it('blocks every other action while the task is open, the enemy turn included', () => {
    const battle = dodging();
    expect(rejectionOf(heroDoes(battle, { kind: 'take-hit' }).events)).toBe('TASK_OPEN');
    expect(rejectionOf(enemyTurn(battle).events)).toBe('TASK_OPEN');
    expect(rejectionOf(heroDoes(heroHitTwice(), { kind: 'task-timeout' }).events)).toBe('NO_TASK');
  });

  it('keeps the answer out of the projection', () => {
    const battle = dodging();
    expect(projectBattleForViewer(battle, 'heroes').task!.answer).toBe(0);
    expect(battle.task!.answer).not.toBe(0);
  });

  it('builds distractors within nine of the answer, all positive and unique', () => {
    for (let seed = 0; seed < 50; seed++) {
      const options = taskOptions(2, createSeededRandom({ seed: `o${seed}`, counter: 0 }));
      expect(options).toHaveLength(4);
      expect(new Set(options).size).toBe(4);
      expect(options).toContain(2);
      expect(options.every((o) => o > 0 && Math.abs(o - 2) <= 9)).toBe(true);
    }
  });

  it('draws the same task for the same seed', () => {
    expect(dodging().task).toEqual(dodging().task);
  });
});

describe('REQ-BTL-007 dodge', () => {
  it('costs 6 Will and, answered right in time, takes exactly the first strike away', () => {
    const battle = dodging();
    expect(battle.turnWill).toBe(14);
    const { battle: after, events } = heroDoes(
      battle,
      { kind: 'answer-task', option: rightAnswer(battle) },
      'hero',
      T0 + 4_000,
    );
    expect(after.creatures[0].hp).toBe(5);
    const resolved = events.find((e) => e.type === 'STRIKES_RESOLVED')!.payload as {
      results: { outcome: string }[];
    };
    expect(resolved.results.map((r) => r.outcome)).toEqual(['dodged', 'hit']);
    expect(after.phase).toBe('act');
  });

  it('counts a right answer after the deadline as wrong', () => {
    const battle = dodging();
    const { battle: after, events } = heroDoes(
      battle,
      { kind: 'answer-task', option: rightAnswer(battle) },
      'hero',
      T0 + BATTLE_RULES.taskMs + 1,
    );
    expect(after.creatures[0].hp).toBe(3);
    expect(events[0].payload).toMatchObject({ correct: false, late: true });
  });

  it('lets every strike through on a wrong answer or a timeout', () => {
    const battle = dodging();
    const wrong = heroDoes(
      battle,
      { kind: 'answer-task', option: wrongAnswer(battle) },
      'hero',
      T0,
    );
    expect(wrong.battle.creatures[0].hp).toBe(3);
    const timeout = heroDoes(battle, { kind: 'task-timeout' }, 'hero', T0 + 9_000);
    expect(timeout.battle.creatures[0].hp).toBe(3);
  });

  it('gives back raised shields when the hero switches to a dodge', () => {
    let battle = heroDoes(heroHitTwice(), { kind: 'place-shield', hex: { q: 1, r: 0 } }).battle;
    battle = heroDoes(battle, { kind: 'start-dodge' }, 'hero', T0).battle;
    expect(battle.placedShields).toEqual([]);
    expect(battle.turnWill).toBe(14);
  });
});
