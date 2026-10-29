import type { DomainEvent } from '../commands/types';
import type { BattleRules } from './battle-content';
import type { BattleState } from './battle-state';
import { creatureById, isAlive } from './battle-board';
import { rollRound } from './initiative';

function resetTurnScratch(state: BattleState): void {
  state.struckHands = [];
  state.placedShields = [];
  state.lockedShields = 0;
  state.undo = [];
}

export function hasPendingStrikes(state: BattleState, creatureId: string): boolean {
  return state.pending.some((s) => s.targetId === creatureId);
}

export function beginTurn(
  state: BattleState,
  creatureId: string,
  rules: BattleRules,
): DomainEvent[] {
  resetTurnScratch(state);
  state.activeId = creatureId;
  const stance = state.stance[creatureId] ?? 0;
  delete state.stance[creatureId];

  const guard = state.guards[creatureId] ?? [];
  delete state.guards[creatureId];

  const defending = hasPendingStrikes(state, creatureId);
  if (defending) {
    state.placedShields = guard.map((hex) => ({ ...hex }));
    state.lockedShields = guard.length;
  }
  state.phase = defending ? 'defend' : 'act';
  state.turnWill = rules.willPerTurn + (defending ? stance : 0);

  return [
    {
      type: 'TURN_STARTED',
      payload: { creatureId, round: state.round, phase: state.phase, will: state.turnWill },
    },
  ];
}

export function startRound(state: BattleState, rules: BattleRules): DomainEvent[] {
  state.round += 1;
  const { draws, order } = rollRound(state);
  state.draws = draws;
  state.order = order;
  state.turnIndex = 0;
  const rolled: DomainEvent = {
    type: 'INITIATIVE_ROLLED',
    payload: { round: state.round, draws, order },
  };
  return [rolled, ...beginTurn(state, order[0], rules)];
}

export function advanceTurn(state: BattleState, rules: BattleRules): DomainEvent[] {
  if (state.phase === 'ended') return [];
  for (let index = state.turnIndex + 1; index < state.order.length; index++) {
    const next = creatureById(state, state.order[index]);
    if (next && isAlive(next)) {
      state.turnIndex = index;
      return beginTurn(state, next.id, rules);
    }
  }
  return startRound(state, rules);
}

export function finishTurn(state: BattleState, stance: number, rules: BattleRules): DomainEvent[] {
  const creatureId = state.activeId;
  if (stance > 0) state.stance[creatureId] = stance;
  const self = creatureById(state, creatureId);
  if (state.phase === 'act' && self && isAlive(self) && state.placedShields.length) {
    state.guards[creatureId] = state.placedShields.map((hex) => ({ ...hex }));
  }
  resetTurnScratch(state);
  state.turnWill = 0;
  const ended: DomainEvent = { type: 'TURN_ENDED', payload: { creatureId, stance } };
  return [ended, ...advanceTurn(state, rules)];
}

export function endTurnIfActiveFell(state: BattleState, rules: BattleRules): DomainEvent[] {
  const active = creatureById(state, state.activeId);
  if (state.phase === 'ended' || !active || isAlive(active)) return [];
  return finishTurn(state, 0, rules);
}

export function endTurn(state: BattleState, rules: BattleRules): DomainEvent[] {
  return finishTurn(state, Math.min(rules.stanceMax, state.turnWill), rules);
}
