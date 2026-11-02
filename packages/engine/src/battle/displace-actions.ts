import type { DomainEvent } from '../commands/types';
import type { BattleRules } from './battle-content';
import type { BattleCreature, BattleState } from './battle-state';
import { spendTurnWill, type BattleRejection } from './battle-rejection';
import { findDisplaceable, resolvePush, validatePush } from './displacement';
import { issueTask } from './timed-task';
import { endTurnIfActiveFell } from './turn';

export function startPush(
  state: BattleState,
  actor: BattleCreature,
  targetId: string,
  atMs: number,
  rules: BattleRules,
): DomainEvent[] | BattleRejection {
  const target = findDisplaceable(state, targetId, rules);
  const invalid = validatePush(state, actor, target);
  if (invalid) return invalid;
  const refused = spendTurnWill(state, rules.push);
  if (refused) return refused;

  state.undo = [];
  const started: DomainEvent = {
    type: 'DISPLACE_STARTED',
    payload: {
      creatureId: actor.id,
      targetId,
      mode: 'push',
      cost: rules.push,
      willLeft: state.turnWill,
    },
  };
  if (actor.side === 'heroes') {
    return [started, ...issueTask(state, 'push', actor.id, atMs, rules, { targetId })];
  }
  return [
    started,
    ...resolvePush(state, actor, target!, atMs, rules),
    ...endTurnIfActiveFell(state, rules),
  ];
}
