import type { DomainEvent } from '../commands/types';
import type { BattleRules } from './battle-content';
import type { BattleCreature, BattleHand, BattleHex, BattleState } from './battle-state';
import { creatureById, freeNeighbours, heightAt, isAlive } from './battle-board';
import { isAdjacentHex } from './hex-battle-geom';
import { reject, spendTurnWill, type BattleRejection } from './battle-rejection';

export function strikeRing(
  state: BattleState,
  target: BattleCreature,
  attackerId: string,
): BattleHex[] {
  return freeNeighbours(state, target.pos, attackerId);
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
  if (!isAdjacentHex(attacker.pos, target.pos)) return reject('NOT_ADJACENT');
  if (!attacker.hands[hand]?.power) return reject('NO_WEAPON_IN_HAND');
  if (state.struckHands.includes(hand)) return reject('HAND_ALREADY_STRUCK');
  return null;
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
    fromHex: { ...attacker.pos },
    ring: strikeRing(state, target!, attacker.id),
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
