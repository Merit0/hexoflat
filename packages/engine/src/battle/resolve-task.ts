import type { DomainEvent } from '../commands/types';
import type { BattleRules } from './battle-content';
import type { BattleCreature, BattleState, BattleTask } from './battle-state';
import { isRejection, type BattleRejection } from './battle-rejection';
import { resolveStrikes } from './defend';
import { findDisplaceable, resolveDisplacement } from './displacement';
import { sawOutcome } from './hazard';
import { gradeTask } from './timed-task';
import { endTurnIfActiveFell } from './turn';

function displaceOutcome(
  state: BattleState,
  actor: BattleCreature,
  task: BattleTask,
  correct: boolean,
  atMs: number,
  rules: BattleRules,
): DomainEvent[] {
  const target = task.targetId ? findDisplaceable(state, task.targetId, rules) : null;
  if (!correct || !target) {
    return [
      { type: 'DISPLACE_FAILED', payload: { targetId: task.targetId, reason: 'TASK_FAILED' } },
    ];
  }
  return resolveDisplacement(state, actor, target, task.kind as 'push' | 'pull', atMs, rules);
}

function outcome(
  state: BattleState,
  actor: BattleCreature,
  task: BattleTask,
  correct: boolean,
  atMs: number,
  rules: BattleRules,
): DomainEvent[] {
  switch (task.kind) {
    case 'dodge':
      return resolveStrikes(state, actor, rules, correct);
    case 'saw':
      return sawOutcome(state, actor, correct, task.backHex, task.pusherHex);
    case 'push':
    case 'pull':
      return displaceOutcome(state, actor, task, correct, atMs, rules);
  }
}

export function settleTask(
  state: BattleState,
  actor: BattleCreature,
  option: number | null,
  atMs: number,
  rules: BattleRules,
): DomainEvent[] | BattleRejection {
  const graded = gradeTask(state, actor.id, option, atMs);
  if (isRejection(graded)) return graded;
  const { task, correct, late } = graded;
  const resolved: DomainEvent = {
    type: 'TASK_RESOLVED',
    payload: {
      taskId: task.id,
      kind: task.kind,
      creatureId: actor.id,
      correct,
      late,
      answer: task.answer,
    },
  };
  return [
    resolved,
    ...outcome(state, actor, task, correct, atMs, rules),
    ...endTurnIfActiveFell(state, rules),
  ];
}
