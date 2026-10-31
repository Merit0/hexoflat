import type { DomainEvent } from '../commands/types';
import { assertNever } from '../utils/assert-never';
import type { BattleRules } from './battle-content';
import type { BattleAction } from './battle-commands';
import type { BattleCreature, BattleState } from './battle-state';
import { reject, type BattleRejection } from './battle-rejection';
import { confirmBlock, placeShield, removeShield, startDodge, takeHit } from './defend';
import { startPush } from './displace-actions';
import { setHands, swapItem, useItem } from './items';
import { moveCreature, undoStep } from './movement';
import { settleTask } from './resolve-task';
import { strike } from './strike';
import { endTurn } from './turn';

const DEFEND_ACTIONS: ReadonlySet<BattleAction['kind']> = new Set([
  'confirm-block',
  'take-hit',
  'start-dodge',
]);

const TASK_ACTIONS: ReadonlySet<BattleAction['kind']> = new Set(['answer-task', 'task-timeout']);

const ANY_PHASE_ACTIONS: ReadonlySet<BattleAction['kind']> = new Set([
  'place-shield',
  'remove-shield',
]);

function phaseAllows(state: BattleState, action: BattleAction): boolean {
  if (ANY_PHASE_ACTIONS.has(action.kind)) return state.phase === 'defend' || state.phase === 'act';
  return DEFEND_ACTIONS.has(action.kind) ? state.phase === 'defend' : state.phase === 'act';
}

function guard(
  state: BattleState,
  actor: BattleCreature,
  action: BattleAction,
): BattleRejection | null {
  if (state.phase === 'ended') return reject('BATTLE_ENDED');
  if (TASK_ACTIONS.has(action.kind)) return state.task ? null : reject('NO_TASK');
  if (state.task) return reject('TASK_OPEN');
  if (state.activeId !== actor.id) return reject('NOT_YOUR_TURN');
  if (!phaseAllows(state, action)) return reject('WRONG_PHASE');
  return null;
}

export function performAction(
  state: BattleState,
  actor: BattleCreature,
  action: BattleAction,
  atMs: number,
  rules: BattleRules,
): DomainEvent[] | BattleRejection {
  const refused = guard(state, actor, action);
  if (refused) return refused;

  switch (action.kind) {
    case 'place-shield':
      return placeShield(state, actor, action.hex, rules);
    case 'remove-shield':
      return removeShield(state, actor, action.hex, rules);
    case 'confirm-block':
      return confirmBlock(state, actor, rules);
    case 'take-hit':
      return takeHit(state, actor, rules);
    case 'start-dodge':
      return startDodge(state, actor, atMs, rules);
    case 'move':
      return moveCreature(state, actor, action.hex, atMs, rules);
    case 'undo-step':
      return undoStep(state, actor);
    case 'strike':
      return strike(state, actor, action.targetId, action.hand, rules);
    case 'push':
      return startPush(state, actor, action.targetId, atMs, rules);
    case 'answer-task':
      return settleTask(state, actor, action.option, atMs, rules);
    case 'task-timeout':
      return settleTask(state, actor, null, atMs, rules);
    case 'swap-item':
      return swapItem(state, actor, action.hand, action.bagIndex, rules);
    case 'use-item':
      return useItem(state, actor, action.hand);
    case 'set-hands':
      return setHands(state, actor, { right: action.right, left: action.left }, rules);
    case 'end-turn':
      return endTurn(state, rules);
    default:
      return assertNever(action);
  }
}
