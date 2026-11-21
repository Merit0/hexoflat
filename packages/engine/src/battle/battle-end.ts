import type { DomainEvent } from '../commands/types';
import type { BattleCreature, BattleOutcome, BattleState } from './battle-state';
import { isAlive, livingOnSide } from './battle-board';
import { enterCollectPhase } from './collect';

function decideOutcome(state: BattleState): BattleOutcome | null {
  if (livingOnSide(state, 'enemies').length === 0) return 'victory';
  if (livingOnSide(state, 'heroes').length === 0) return 'defeat';
  return null;
}

function heroResult(creature: BattleCreature) {
  return { id: creature.id, hp: creature.hp, maxHp: creature.maxHp };
}

export function checkBattleEnd(state: BattleState): DomainEvent[] {
  if (state.phase === 'ended') return [];
  const outcome = decideOutcome(state);
  if (!outcome) return [];

  state.phase = 'ended';
  state.outcome = outcome;
  state.turnWill = 0;
  state.stance = {};
  state.placedShields = [];
  state.struckHands = [];
  state.pending = [];
  state.undo = [];

  const kills = state.creatures.filter((c) => c.side === 'enemies' && !isAlive(c)).length;
  const heroes = state.creatures.filter((c) => c.side === 'heroes').map(heroResult);
  const ended: DomainEvent = {
    type: 'BATTLE_ENDED',
    payload: { battleId: state.id, outcome, kills, heroes },
  };
  return state.lootEnabled && outcome === 'victory'
    ? [ended, ...enterCollectPhase(state)]
    : [ended];
}

export function applyDamage(
  state: BattleState,
  creature: BattleCreature,
  amount: number,
  trophyBonus = 0,
): DomainEvent[] {
  if (amount <= 0 || !isAlive(creature)) return [];
  creature.hp = Math.max(0, creature.hp - amount);
  const events: DomainEvent[] = [
    { type: 'CREATURE_DAMAGED', payload: { creatureId: creature.id, amount, hp: creature.hp } },
  ];
  if (creature.hp > 0) return events;

  if (creature.side === 'enemies' && trophyBonus > 0) creature.trophyBonus = trophyBonus;

  state.pending = state.pending.filter((s) => s.targetId !== creature.id);
  if (state.lootEnabled) state.fallen = [...(state.fallen ?? []), creature.id];
  events.push({ type: 'CREATURE_FELL', payload: { creatureId: creature.id } });
  return [...events, ...checkBattleEnd(state)];
}
