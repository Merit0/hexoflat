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
import { taskOptions } from './timed-task';
import { createSeededRandom } from '../utils/random-seeded';

const T0 = 10_000;

function scene(): BattleState {
  return giveTurn(battleWith([hero({ q: 0, r: 0 }), skeleton('s1', { q: 1, r: 0 })]), [
    'hero',
    's1',
  ]);
}

function pushing(): BattleState {
  return heroDoes(scene(), { kind: 'push', targetId: 's1' }, 'hero', T0).battle;
}

describe('timed task', () => {
  it('opens a task with four distinct positive options and a 5 s deadline', () => {
    const { battle } = heroDoes(scene(), { kind: 'push', targetId: 's1' }, 'hero', T0);
    const task = battle.task!;
    expect(task.kind).toBe('push');
    expect(task.deadlineMs).toBe(T0 + BATTLE_RULES.taskMs);
    expect(new Set(task.options).size).toBe(4);
    expect(task.options.every((o) => o > 0)).toBe(true);
    expect(task.options).toContain(task.answer);
  });

  it('blocks every other action while the task is open, the enemy turn included', () => {
    const battle = pushing();
    expect(rejectionOf(heroDoes(battle, { kind: 'end-turn' }).events)).toBe('TASK_OPEN');
    expect(rejectionOf(enemyTurn(battle).events)).toBe('TASK_OPEN');
    expect(rejectionOf(heroDoes(scene(), { kind: 'task-timeout' }).events)).toBe('NO_TASK');
  });

  it('keeps the answer out of the projection', () => {
    const battle = pushing();
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
    expect(pushing().task).toEqual(pushing().task);
  });

  it('counts a right answer after the deadline as wrong', () => {
    const battle = pushing();
    const { events } = heroDoes(
      battle,
      { kind: 'answer-task', option: rightAnswer(battle) },
      'hero',
      T0 + BATTLE_RULES.taskMs + BATTLE_RULES.networkGraceMs + 1,
    );
    expect(events[0].payload).toMatchObject({ correct: false, late: true });
  });

  it('counts a wrong answer and a timeout as failed', () => {
    const battle = pushing();
    const wrong = heroDoes(
      battle,
      { kind: 'answer-task', option: wrongAnswer(battle) },
      'hero',
      T0,
    );
    expect(wrong.events[0].payload).toMatchObject({ correct: false });
    const timeout = heroDoes(battle, { kind: 'task-timeout' }, 'hero', T0 + 9_000);
    expect(timeout.events[0].payload).toMatchObject({ correct: false });
  });
});

describe('the network grace of a task', () => {
  it('still counts a right answer that arrives within the grace after the deadline', () => {
    const battle = pushing();
    const { events } = heroDoes(
      battle,
      { kind: 'answer-task', option: rightAnswer(battle) },
      'hero',
      T0 + BATTLE_RULES.taskMs + BATTLE_RULES.networkGraceMs,
    );
    expect(events[0].payload).toMatchObject({ correct: true, late: false });
  });
});

describe('the network grace of a task', () => {
  it('still counts a right answer that arrives within the grace after the deadline', () => {
    const battle = pushing();
    const { events } = heroDoes(
      battle,
      { kind: 'answer-task', option: rightAnswer(battle) },
      'hero',
      T0 + BATTLE_RULES.taskMs + BATTLE_RULES.networkGraceMs,
    );
    expect(events[0].payload).toMatchObject({ correct: true, late: false });
  });
});
