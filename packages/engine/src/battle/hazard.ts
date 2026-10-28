import type { DomainEvent } from '../commands/types';
import type { BattleRules } from './battle-content';
import type { BattleCreature, BattleHex, BattleState } from './battle-state';
import { freeNeighbours, isAlive, isFreeHex } from './battle-board';
import { battleDistance, hexKey } from './hex-battle-geom';
import { applyDamage } from './battle-end';
import { issueTask } from './timed-task';

export function sawDamage(hp: number): number {
  return Math.max(1, Math.ceil(hp / 2));
}

function throwBackHex(
  state: BattleState,
  creature: BattleCreature,
  backHex: BattleHex | undefined,
  pusherHex: BattleHex | undefined,
): BattleHex | null {
  if (backHex && isFreeHex(state, backHex, creature.id)) return backHex;
  const away = (hex: BattleHex) => (pusherHex ? battleDistance(hex, pusherHex) : 0);
  const options = freeNeighbours(state, creature.pos)
    .filter((hex) => state.board[hexKey(hex)] !== 'saw')
    .sort((a, b) => away(b) - away(a) || hexKey(a).localeCompare(hexKey(b)));
  return options[0] ?? null;
}

export function throwClearOfSaw(
  state: BattleState,
  creature: BattleCreature,
  backHex: BattleHex | undefined,
  pusherHex: BattleHex | undefined,
): DomainEvent[] {
  if (!isAlive(creature)) return [];
  const to = throwBackHex(state, creature, backHex, pusherHex);
  if (!to) return [];
  const from = creature.pos;
  creature.pos = { ...to };
  return [{ type: 'THROWN_CLEAR', payload: { creatureId: creature.id, from, to } }];
}

export function sawOutcome(
  state: BattleState,
  creature: BattleCreature,
  dodged: boolean,
  backHex: BattleHex | undefined,
  pusherHex: BattleHex | undefined,
): DomainEvent[] {
  const damage = dodged ? [] : applyDamage(state, creature, sawDamage(creature.hp));
  return [...damage, ...throwClearOfSaw(state, creature, backHex, pusherHex)];
}

export function enterSaw(
  state: BattleState,
  creature: BattleCreature,
  backHex: BattleHex,
  pusherHex: BattleHex | undefined,
  atMs: number,
  rules: BattleRules,
): DomainEvent[] {
  const triggered: DomainEvent = {
    type: 'HAZARD_TRIGGERED',
    payload: { creatureId: creature.id, hex: creature.pos, hazard: 'saw' },
  };
  if (creature.side === 'heroes') {
    return [
      triggered,
      ...issueTask(state, 'saw', creature.id, atMs, rules, { backHex, pusherHex }),
    ];
  }
  return [triggered, ...sawOutcome(state, creature, false, backHex, pusherHex)];
}
