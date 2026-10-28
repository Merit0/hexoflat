import type { DomainEvent } from '../commands/types';
import type { BattleRules } from './battle-content';
import type { BattleCreature, BattleState } from './battle-state';
import { spendTurnWill, type BattleRejection } from './battle-rejection';
import {
  findDisplaceable,
  resolveDisplacement,
  validateDisplacement,
  type DisplaceMode,
} from './displacement';
import { issueTask } from './timed-task';
import { endTurnIfActiveFell } from './turn';

export function startDisplace(
  state: BattleState,
  actor: BattleCreature,
  targetId: string,
  mode: DisplaceMode,
  atMs: number,
  rules: BattleRules,
): DomainEvent[] | BattleRejection {
  const target = findDisplaceable(state, targetId, rules);
  const invalid = validateDisplacement(state, actor, target, mode, rules);
  if (invalid) return invalid;
  const cost = mode === 'push' ? rules.push : rules.pull;
  const refused = spendTurnWill(state, cost);
  if (refused) return refused;

  state.undo = [];
  const started: DomainEvent = {
    type: 'DISPLACE_STARTED',
    payload: { creatureId: actor.id, targetId, mode, cost, willLeft: state.turnWill },
  };
  if (actor.side === 'heroes') {
    return [started, ...issueTask(state, mode, actor.id, atMs, rules, { targetId })];
  }
  return [
    started,
    ...resolveDisplacement(state, actor, target!, mode, atMs, rules),
    ...endTurnIfActiveFell(state, rules),
  ];
}
