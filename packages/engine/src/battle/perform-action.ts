import type { DomainEvent } from '../commands/types';
import { assertNever } from '../utils/assert-never';
import type { BattleRules } from './battle-content';
import type { BattleAction } from './battle-commands';
import type { BattleCreature, BattleState } from './battle-state';
import { reject, type BattleRejection } from './battle-rejection';
import { confirmBlock, placeShield, removeShield, takeHit } from './defend';
import { moveCreature, undoStep } from './movement';
import { strike } from './strike';
import { endTurn } from './turn';

const DEFEND_ACTIONS: ReadonlySet<BattleAction['kind']> = new Set([
  'place-shield',
  'remove-shield',
  'confirm-block',
  'take-hit',
]);

function phaseAllows(state: BattleState, action: BattleAction): boolean {
  return DEFEND_ACTIONS.has(action.kind) ? state.phase === 'defend' : state.phase === 'act';
}

export function performAction(
  state: BattleState,
  actor: BattleCreature,
  action: BattleAction,
  rules: BattleRules,
): DomainEvent[] | BattleRejection {
  if (state.phase === 'ended') return reject('BATTLE_ENDED');
  if (state.activeId !== actor.id) return reject('NOT_YOUR_TURN');
  if (!phaseAllows(state, action)) return reject('WRONG_PHASE');

  switch (action.kind) {
    case 'place-shield':
      return placeShield(state, actor, action.hex, rules);
    case 'remove-shield':
      return removeShield(state, actor, action.hex, rules);
    case 'confirm-block':
      return confirmBlock(state, actor, rules);
    case 'take-hit':
      return takeHit(state, actor, rules);
    case 'move':
      return moveCreature(state, actor, action.hex, rules);
    case 'undo-step':
      return undoStep(state, actor);
    case 'strike':
      return strike(state, actor, action.targetId, action.hand, rules);
    case 'end-turn':
      return endTurn(state, rules);
    default:
      return assertNever(action);
  }
}
