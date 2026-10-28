import type { DomainEvent } from '../commands/types';
import type { BattleRules } from './battle-content';
import type { BattleCreature, BattleHex, BattleState, PendingStrike } from './battle-state';
import { isAlive } from './battle-board';
import { sameHex } from './hex-battle-geom';
import { reject, spendTurnWill, type BattleRejection } from './battle-rejection';
import { applyDamage } from './battle-end';
import { finishTurn } from './turn';
import { issueTask } from './timed-task';

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

export function placeShield(
  state: BattleState,
  defender: BattleCreature,
  hex: BattleHex,
  rules: BattleRules,
): DomainEvent[] | BattleRejection {
  const capacity = shieldCapacity(defender, rules);
  if (capacity === 0) return reject('NO_SHIELD_IN_HAND');
  if (!inAnyRing(strikesOn(state, defender.id), hex)) return reject('NOT_IN_RING');
  if (state.placedShields.some((h) => sameHex(h, hex))) return reject('SHIELD_ALREADY_PLACED');
  if (state.placedShields.length >= capacity) return reject('SHIELD_CAPACITY_REACHED');
  const refused = spendTurnWill(state, rules.shieldPerSide);
  if (refused) return refused;

  state.placedShields.push({ ...hex });
  return [
    {
      type: 'SHIELD_PLACED',
      payload: {
        creatureId: defender.id,
        hex,
        cost: rules.shieldPerSide,
        willLeft: state.turnWill,
      },
    },
  ];
}

export function removeShield(
  state: BattleState,
  defender: BattleCreature,
  hex: BattleHex,
  rules: BattleRules,
): DomainEvent[] | BattleRejection {
  const index = state.placedShields.findIndex((h) => sameHex(h, hex));
  if (index < 0) return reject('NO_SHIELD_THERE');
  state.placedShields.splice(index, 1);
  state.turnWill += rules.shieldPerSide;
  return [
    {
      type: 'SHIELD_REMOVED',
      payload: {
        creatureId: defender.id,
        hex,
        refund: rules.shieldPerSide,
        willLeft: state.turnWill,
      },
    },
  ];
}

function resolveOne(state: BattleState, strike: PendingStrike, dodged: boolean) {
  const blocked = state.placedShields.some((h) => sameHex(h, strike.fromHex));
  const outcome = dodged ? 'dodged' : blocked ? 'blocked' : 'hit';
  return {
    strikeId: strike.id,
    attackerId: strike.attackerId,
    fromHex: strike.fromHex,
    outcome,
    damage: outcome === 'hit' ? strike.power : 0,
  };
}

export function resolveStrikes(
  state: BattleState,
  defender: BattleCreature,
  rules: BattleRules,
  dodgeFirst = false,
): DomainEvent[] {
  const strikes = strikesOn(state, defender.id);
  const results = strikes.map((s, index) => resolveOne(state, s, dodgeFirst && index === 0));
  const shields = state.placedShields;
  state.pending = state.pending.filter((s) => s.targetId !== defender.id);
  state.placedShields = [];

  const damage = results.reduce((sum, r) => sum + r.damage, 0);
  const events: DomainEvent[] = [
    {
      type: 'STRIKES_RESOLVED',
      payload: { creatureId: defender.id, results, burnedShields: shields },
    },
    ...applyDamage(state, defender, damage),
  ];
  if (state.phase === 'ended') return events;
  if (!isAlive(defender)) return [...events, ...finishTurn(state, 0, rules)];

  state.turnWill = Math.min(state.turnWill, rules.willPerTurn);
  state.phase = 'act';
  return [...events, { type: 'PHASE_CHANGED', payload: { phase: 'act', will: state.turnWill } }];
}

export function confirmBlock(
  state: BattleState,
  defender: BattleCreature,
  rules: BattleRules,
): DomainEvent[] | BattleRejection {
  if (state.placedShields.length === 0) return reject('NO_SHIELD_PLACED');
  return resolveStrikes(state, defender, rules);
}

export function startDodge(
  state: BattleState,
  defender: BattleCreature,
  atMs: number,
  rules: BattleRules,
): DomainEvent[] | BattleRejection {
  const refund = state.placedShields.length * rules.shieldPerSide;
  if (state.turnWill + refund < rules.dodge) {
    return { rejected: 'INSUFFICIENT_WILL', cost: rules.dodge, left: state.turnWill + refund };
  }
  state.turnWill += refund - rules.dodge;
  state.placedShields = [];
  return [
    {
      type: 'DODGE_STARTED',
      payload: { creatureId: defender.id, cost: rules.dodge, willLeft: state.turnWill },
    },
    ...issueTask(state, 'dodge', defender.id, atMs, rules),
  ];
}

export function takeHit(
  state: BattleState,
  defender: BattleCreature,
  rules: BattleRules,
): DomainEvent[] {
  state.turnWill += state.placedShields.length * rules.shieldPerSide;
  state.placedShields = [];
  return resolveStrikes(state, defender, rules);
}
