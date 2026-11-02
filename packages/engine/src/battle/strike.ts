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
  strikeSideHexes,
  heightAt,
  isAlive,
  terrainAt,
  type BattleBoardView,
} from './battle-board';
import { archerArc, battleDistance, hexKey, isAdjacentHex } from './hex-battle-geom';
import { cheapestPaths } from './movement';
import { reject, spendTurnWill, type BattleRejection } from './battle-rejection';

export function isRangedStrike(
  weapon: BattleItem | null,
  attacker: BattleCreature,
  target: BattleCreature,
): boolean {
  return !!weapon?.range && !isAdjacentHex(attacker.pos, target.pos);
}

export function strikeRing(
  state: BattleState,
  target: BattleCreature,
  attacker: BattleCreature,
  ranged: boolean,
): BattleHex[] {
  if (!ranged) return strikeSideHexes(state, target.pos, attacker.id);
  return archerArc(target.pos, attacker.pos).filter((hex) => {
    const terrain = terrainAt(state, hex);
    return terrain !== null && terrain !== 'saw';
  });
}

function strikeSide(target: BattleCreature, attacker: BattleCreature, ranged: boolean): BattleHex {
  if (!ranged) return { ...attacker.pos };
  return archerArc(target.pos, attacker.pos)[1];
}

export function reachableRing(
  state: BattleBoardView,
  attacker: BattleCreature,
  ring: readonly BattleHex[],
  willLeft: number,
  rules: BattleRules,
): BattleHex[] {
  const nodes = cheapestPaths(state, attacker, rules);
  return ring
    .map((hex) => ({ hex, cost: nodes.get(hexKey(hex))?.cost }))
    .filter((entry): entry is { hex: BattleHex; cost: number } => {
      return entry.cost !== undefined && entry.cost <= willLeft;
    })
    .sort((a, b) => a.cost - b.cost)
    .map((entry) => ({ ...entry.hex }));
}

export function isCornered(state: BattleBoardView, creature: BattleCreature): boolean {
  return freeNeighbours(state, creature.pos).every((hex) => terrainAt(state, hex) === 'saw');
}

export function reachRefusal(
  state: BattleBoardView,
  attacker: BattleCreature,
  target: BattleCreature,
  weapon: BattleItem,
  willLeft: number,
  rules: BattleRules,
): BattleRejection | null {
  const distance = battleDistance(attacker.pos, target.pos);
  if (!weapon.range) {
    const ring = strikeSideHexes(state, target.pos, attacker.id);
    return reachableRing(state, attacker, ring, willLeft, rules).length > 0
      ? null
      : reject('NOT_ADJACENT');
  }
  if (distance === 1) return isCornered(state, attacker) ? null : reject('TOO_CLOSE');
  return distance >= weapon.range.min && distance <= weapon.range.max
    ? null
    : reject('OUT_OF_RANGE');
}

export function strikingItem(
  creature: BattleCreature,
  hand: BattleHand,
  rules: BattleRules,
): BattleItem | null {
  const item = creature.hands[hand];
  if (!item) return { key: 'unarmed', power: rules.unarmedPower };
  return item.power ? item : null;
}

export function strikePower(
  state: BattleState,
  attacker: BattleCreature,
  target: BattleCreature,
  hand: BattleHand,
  rules: BattleRules,
): number {
  const base = strikingItem(attacker, hand, rules)?.power ?? 0;
  const fromAbove = heightAt(state, attacker.pos) > heightAt(state, target.pos);
  return base + (fromAbove ? rules.ledgeStrikeBonus : 0);
}

function validateStrike(
  state: BattleState,
  attacker: BattleCreature,
  target: BattleCreature | null,
  hand: BattleHand,
  rules: BattleRules,
): BattleRejection | null {
  if (!target || !isAlive(target) || target.side === attacker.side) return reject('NOT_AN_ENEMY');
  const weapon = strikingItem(attacker, hand, rules);
  if (!weapon) return reject('NO_WEAPON_IN_HAND');
  if (state.struckHands.includes(hand)) return reject('HAND_ALREADY_STRUCK');
  if (state.turnWill < rules.strike) return null;
  return reachRefusal(state, attacker, target, weapon, state.turnWill - rules.strike, rules);
}

export function strike(
  state: BattleState,
  attacker: BattleCreature,
  targetId: string,
  hand: BattleHand,
  rules: BattleRules,
): DomainEvent[] | BattleRejection {
  const target = creatureById(state, targetId);
  const invalid = validateStrike(state, attacker, target, hand, rules);
  if (invalid) return invalid;
  const refused = spendTurnWill(state, rules.strike);
  if (refused) return refused;

  const ranged = isRangedStrike(strikingItem(attacker, hand, rules), attacker, target!);
  state.strikeSeq += 1;
  const pending = {
    id: `${state.id}:strike:${state.strikeSeq}`,
    attackerId: attacker.id,
    targetId: target!.id,
    fromHex: strikeSide(target!, attacker, ranged),
    ring: strikeRing(state, target!, attacker, ranged),
    power: strikePower(state, attacker, target!, hand, rules),
  };
  state.pending.push(pending);
  state.struckHands.push(hand);
  state.undo = [];
  const dealt: DomainEvent = {
    type: 'STRIKE_DEALT',
    payload: {
      ...pending,
      hand,
      itemKey: strikingItem(attacker, hand, rules)!.key,
      cost: rules.strike,
      willLeft: state.turnWill,
    },
  };
  return [dealt];
}
