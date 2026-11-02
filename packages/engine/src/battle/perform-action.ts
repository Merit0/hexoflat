import type { DomainEvent } from '../commands/types';
import { assertNever } from '../utils/assert-never';
import type { BattleRules } from './battle-content';
import type { BattleAction } from './battle-commands';
import type { BattleCreature, BattleState } from './battle-state';
import { isRejection, reject, type BattleRejection } from './battle-rejection';
import { placeShield, reactionTimeout, removeShield, shieldCapacity, takeHit } from './defend';
import { aimStrike, finishBlock, openReaction } from './reaction';
import { startPush } from './displace-actions';
import { setHands, swapItem, useItem } from './items';
import { moveCreature, undoStep } from './movement';
import { settleTask } from './resolve-task';
import { strike } from './strike';
import { endTurn } from './turn';

const DEFEND_ACTIONS: ReadonlySet<BattleAction['kind']> = new Set([
  'place-shield',
  'remove-shield',
  'take-hit',
]);

const AIM_ACTIONS: ReadonlySet<BattleAction['kind']> = new Set(['aim', 'reaction-timeout']);

const TASK_ACTIONS: ReadonlySet<BattleAction['kind']> = new Set(['answer-task', 'task-timeout']);

const WINDOW_TIMED_ACTIONS: ReadonlySet<BattleAction['kind']> = new Set([
  'place-shield',
  'remove-shield',
  'aim',
]);

function phaseAllows(state: BattleState, action: BattleAction): boolean {
  if (action.kind === 'reaction-timeout') return !!state.reaction;
  return DEFEND_ACTIONS.has(action.kind) ? state.phase === 'defend' : state.phase === 'act';
}

function guard(
  state: BattleState,
  actor: BattleCreature,
  action: BattleAction,
  atMs: number,
): BattleRejection | null {
  if (state.phase === 'ended') return reject('BATTLE_ENDED');
  if (TASK_ACTIONS.has(action.kind)) return state.task ? null : reject('NO_TASK');
  if (state.task) return reject('TASK_OPEN');
  if (state.activeId !== actor.id) return reject('NOT_YOUR_TURN');
  if (state.reaction?.stage === 'aim' && !AIM_ACTIONS.has(action.kind))
    return reject('AIM_PENDING');
  if (action.kind === 'aim' && state.reaction?.stage !== 'aim') return reject('WRONG_PHASE');
  if (!phaseAllows(state, action)) return reject('WRONG_PHASE');
  if (state.reaction && atMs > state.reaction.deadlineMs && WINDOW_TIMED_ACTIONS.has(action.kind))
    return reject('WINDOW_CLOSED');
  return null;
}

function strikeAndReact(
  state: BattleState,
  actor: BattleCreature,
  action: Extract<BattleAction, { kind: 'strike' }>,
  atMs: number,
  rules: BattleRules,
): DomainEvent[] | BattleRejection {
  const dealt = strike(state, actor, action.targetId, action.hand, rules);
  if (isRejection(dealt)) return dealt;
  const target = state.creatures.find((c) => c.id === action.targetId)!;
  const opened = openReaction(state, actor, target, action.hand, atMs, rules);
  if (shieldCapacity(target, rules) > 0) return [...dealt, ...opened];
  const settled = finishBlock(state, target, atMs, rules);
  return isRejection(settled) ? settled : [...dealt, ...opened, ...settled];
}

export function performAction(
  state: BattleState,
  actor: BattleCreature,
  action: BattleAction,
  atMs: number,
  rules: BattleRules,
): DomainEvent[] | BattleRejection {
  const refused = guard(state, actor, action, atMs);
  if (refused) return refused;

  switch (action.kind) {
    case 'place-shield':
      return placeShield(state, actor, action.hex, rules);
    case 'remove-shield':
      return removeShield(state, actor, action.hex);
    case 'reaction-timeout':
      return reactionTimeout(state, actor, atMs, rules);
    case 'aim':
      return aimStrike(state, actor, action.hex, atMs, rules);
    case 'take-hit':
      return takeHit(state, actor, atMs, rules);
    case 'move':
      return moveCreature(state, actor, action.hex, atMs, rules);
    case 'undo-step':
      return undoStep(state, actor);
    case 'strike':
      return strikeAndReact(state, actor, action, atMs, rules);
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
