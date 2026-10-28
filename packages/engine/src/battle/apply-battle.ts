import type { DomainEvent } from '../commands/types';
import { BATTLE_RULES, type BattleRules } from './battle-content';
import type { BattleAction, BattleCommand } from './battle-commands';
import type { BattleState } from './battle-state';
import { creatureById } from './battle-board';
import { isRejection, reject, type BattleRejection } from './battle-rejection';
import { performAction } from './perform-action';
import { projectBattleForViewer } from './projection';
import { nextPlaceholderAction } from './ai/placeholder-enemy';

const MAX_ENEMY_ACTIONS = 64;

export interface BattleResult {
  battle: BattleState;
  events: DomainEvent[];
}

function rejected(battle: BattleState, refusal: BattleRejection, action: string): BattleResult {
  return { battle, events: [{ type: 'BATTLE_REJECTED', payload: { ...refusal, action } }] };
}

function heroAction(
  battle: BattleState,
  heroId: string,
  action: BattleAction,
  rules: BattleRules,
): BattleResult {
  const next = structuredClone(battle);
  const actor = creatureById(next, heroId);
  if (!actor || actor.side !== 'heroes')
    return rejected(battle, reject('NOT_YOUR_TURN'), action.kind);
  const result = performAction(next, actor, action, rules);
  if (isRejection(result)) return rejected(battle, result, action.kind);
  return { battle: next, events: result };
}

function stillActing(battle: BattleState, enemyId: string): boolean {
  return battle.activeId === enemyId && battle.phase !== 'ended';
}

function enemyTurn(battle: BattleState, rules: BattleRules): BattleResult {
  const next = structuredClone(battle);
  const enemyId = next.activeId;
  const actor = creatureById(next, enemyId);
  if (next.phase === 'ended') return rejected(battle, reject('BATTLE_ENDED'), 'run-enemy-turn');
  if (!actor || actor.side !== 'enemies')
    return rejected(battle, reject('NOT_YOUR_TURN'), 'run-enemy-turn');

  const events: DomainEvent[] = [];
  for (let i = 0; i < MAX_ENEMY_ACTIONS && stillActing(next, enemyId); i++) {
    const action = nextPlaceholderAction(projectBattleForViewer(next, 'enemies'), rules);
    const result = performAction(next, actor, action, rules);
    events.push(
      ...(isRejection(result)
        ? (performAction(next, actor, { kind: 'end-turn' }, rules) as DomainEvent[])
        : result),
    );
  }
  return { battle: next, events };
}

export function applyBattleCommand(
  battle: BattleState | undefined,
  command: BattleCommand,
  rules: BattleRules = BATTLE_RULES,
): BattleResult | { battle: undefined; events: DomainEvent[] } {
  if (!battle) {
    return { battle, events: [{ type: 'BATTLE_REJECTED', payload: { rejected: 'NO_BATTLE' } }] };
  }
  const { payload } = command;
  return payload.kind === 'hero'
    ? heroAction(battle, payload.heroId, payload.action, rules)
    : enemyTurn(battle, rules);
}
