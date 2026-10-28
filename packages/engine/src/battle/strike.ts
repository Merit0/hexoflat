import type { DomainEvent } from '../commands/types';
import type { BattleRules } from './battle-content';
import type {
  BattleCreature,
  BattleHand,
  BattleHex,
  BattleItem,
  BattleState,
} from './battle-state';
import {
  creatureById,
  freeNeighbours,
  heightAt,
  isAlive,
  terrainAt,
  type BattleBoardView,
} from './battle-board';
import { archerArc, battleDistance, isAdjacentHex } from './hex-battle-geom';
import { reject, spendTurnWill, type BattleRejection } from './battle-rejection';

export function strikeRing(
  state: BattleState,
  target: BattleCreature,
  attacker: BattleCreature,
): BattleHex[] {
  if (isAdjacentHex(attacker.pos, target.pos))
    return freeNeighbours(state, target.pos, attacker.id);
  return archerArc(target.pos, attacker.pos).filter((hex) => terrainAt(state, hex) !== null);
}

function strikeSide(target: BattleCreature, attacker: BattleCreature): BattleHex {
  if (isAdjacentHex(attacker.pos, target.pos)) return { ...attacker.pos };
  return archerArc(target.pos, attacker.pos)[1];
}

export function isCornered(state: BattleBoardView, creature: BattleCreature): boolean {
  return freeNeighbours(state, creature.pos).every((hex) => terrainAt(state, hex) === 'saw');
}

function reachRefusal(
  state: BattleState,
  attacker: BattleCreature,
  target: BattleCreature,
  weapon: BattleItem,
): BattleRejection | null {
  const distance = battleDistance(attacker.pos, target.pos);
  if (!weapon.range) return distance === 1 ? null : reject('NOT_ADJACENT');
  if (distance === 1) return isCornered(state, attacker) ? null : reject('TOO_CLOSE');
  return distance >= weapon.range.min && distance <= weapon.range.max
    ? null
    : reject('OUT_OF_RANGE');
}

export function strikePower(
  state: BattleState,
  attacker: BattleCreature,
  target: BattleCreature,
  hand: BattleHand,
  rules: BattleRules,
): number {
  const base = attacker.hands[hand]?.power ?? 0;
  const fromAbove = heightAt(state, attacker.pos) > heightAt(state, target.pos);
  return base + (fromAbove ? rules.ledgeStrikeBonus : 0);
}

function validateStrike(
  state: BattleState,
  attacker: BattleCreature,
  target: BattleCreature | null,
  hand: BattleHand,
): BattleRejection | null {
  if (!target || !isAlive(target) || target.side === attacker.side) return reject('NOT_AN_ENEMY');
  const weapon = attacker.hands[hand];
  if (!weapon?.power) return reject('NO_WEAPON_IN_HAND');
  if (state.struckHands.includes(hand)) return reject('HAND_ALREADY_STRUCK');
  return reachRefusal(state, attacker, target, weapon);
}

export function strike(
  state: BattleState,
  attacker: BattleCreature,
  targetId: string,
  hand: BattleHand,
  rules: BattleRules,
): DomainEvent[] | BattleRejection {
  const target = creatureById(state, targetId);
  const invalid = validateStrike(state, attacker, target, hand);
  if (invalid) return invalid;
  const refused = spendTurnWill(state, rules.strike);
  if (refused) return refused;

  state.strikeSeq += 1;
  const pending = {
    id: `${state.id}:strike:${state.strikeSeq}`,
    attackerId: attacker.id,
    targetId: target!.id,
    fromHex: strikeSide(target!, attacker),
    ring: strikeRing(state, target!, attacker),
    power: strikePower(state, attacker, target!, hand, rules),
  };
  state.pending.push(pending);
  state.struckHands.push(hand);
  state.undo = [];
  return [
    {
      type: 'STRIKE_DEALT',
      payload: { ...pending, hand, cost: rules.strike, willLeft: state.turnWill },
    },
  ];
}
