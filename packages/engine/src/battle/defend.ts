import type { DomainEvent } from '../commands/types';
import type { BattleRules } from './battle-content';
import type { BattleCreature, BattleHex, BattleState, PendingStrike } from './battle-state';
import { sameHex } from './hex-battle-geom';
import { reject, type BattleRejection } from './battle-rejection';
import { aimTimeout, finishBlock } from './reaction';

export function shieldCapacity(creature: BattleCreature, rules: BattleRules): number {
  const total =
    (creature.hands.right?.shieldCapacity ?? 0) + (creature.hands.left?.shieldCapacity ?? 0);
  return Math.min(rules.maxShieldSides, total);
}

export function strikesOn(state: BattleState, creatureId: string): PendingStrike[] {
  return state.pending.filter((s) => s.targetId === creatureId);
}

function inAnyRing(strikes: PendingStrike[], hex: BattleHex): boolean {
  return strikes.some((s) => s.ring.some((h) => sameHex(h, hex)));
}

function ringRefusal(
  state: BattleState,
  defender: BattleCreature,
  hex: BattleHex,
): BattleRejection | null {
  return inAnyRing(strikesOn(state, defender.id), hex) ? null : reject('NOT_IN_RING');
}

export function placeShield(
  state: BattleState,
  defender: BattleCreature,
  hex: BattleHex,
  rules: BattleRules,
): DomainEvent[] | BattleRejection {
  if (shieldCapacity(defender, rules) === 0) return reject('NO_SHIELD_IN_HAND');
  const refusedHex = ringRefusal(state, defender, hex);
  if (refusedHex) return refusedHex;
  if (state.placedShields.some((h) => sameHex(h, hex))) return reject('SHIELD_ALREADY_PLACED');
  if (state.placedShields.length >= shieldCapacity(defender, rules)) {
    return reject('SHIELD_CAPACITY_REACHED');
  }

  state.placedShields.push({ ...hex });
  return [{ type: 'SHIELD_PLACED', payload: { creatureId: defender.id, hex } }];
}

export function removeShield(
  state: BattleState,
  defender: BattleCreature,
  hex: BattleHex,
): DomainEvent[] | BattleRejection {
  const index = state.placedShields.findIndex((h) => sameHex(h, hex));
  if (index < 0) return reject('NO_SHIELD_THERE');
  state.placedShields.splice(index, 1);
  return [{ type: 'SHIELD_REMOVED', payload: { creatureId: defender.id, hex } }];
}

export function takeHit(
  state: BattleState,
  defender: BattleCreature,
  atMs: number,
  rules: BattleRules,
): DomainEvent[] | BattleRejection {
  state.placedShields = [];
  return finishBlock(state, defender, atMs, rules);
}

export function reactionTimeout(
  state: BattleState,
  actor: BattleCreature,
  atMs: number,
  rules: BattleRules,
): DomainEvent[] | BattleRejection {
  if (!state.reaction) return reject('WRONG_PHASE');
  return state.reaction.stage === 'aim'
    ? aimTimeout(state, actor, atMs, rules)
    : finishBlock(state, actor, atMs, rules);
}
