import type { DomainEvent } from '../commands/types';
import type { BattleRules } from './battle-content';
import type {
  BattleCreature,
  BattleHand,
  BattleHex,
  BattleState,
  PendingStrike,
} from './battle-state';
import { creatureById } from './battle-board';
import { applyDamage } from './battle-end';
import { isAdjacentHex, sameHex, hexKey } from './hex-battle-geom';
import { cheapestPaths, moveCreature, pathTo } from './movement';
import { reject, type BattleRejection } from './battle-rejection';
import { strikePower, strikingItem } from './strike';

export function openReaction(
  state: BattleState,
  attacker: BattleCreature,
  defender: BattleCreature,
  hand: BattleHand,
  atMs: number,
  rules: BattleRules,
): DomainEvent[] {
  const deadlineMs = atMs + rules.blockWindowMs;
  state.reaction = {
    stage: 'block',
    attackerId: attacker.id,
    defenderId: defender.id,
    hand,
    deadlineMs,
    shields: [],
    resume: {
      phase: state.phase,
      turnWill: state.turnWill,
      placedShields: state.placedShields,
      struckHands: state.struckHands,
      undo: state.undo,
    },
  };
  state.activeId = defender.id;
  state.phase = 'defend';
  state.placedShields = [];
  state.struckHands = [];
  state.undo = [];
  state.turnWill = 0;
  return [
    {
      type: 'REACTION_OPENED',
      payload: { defenderId: defender.id, attackerId: attacker.id, deadlineMs },
    },
  ];
}

function restoreAttacker(state: BattleState): void {
  const reaction = state.reaction!;
  const { resume } = reaction;
  state.activeId = reaction.attackerId;
  state.phase = resume.phase;
  state.turnWill = resume.turnWill;
  state.placedShields = resume.placedShields;
  state.struckHands = resume.struckHands;
  state.undo = resume.undo;
}

export function aimOptions(
  state: Parameters<typeof cheapestPaths>[0],
  attacker: BattleCreature,
  strike: Pick<PendingStrike, 'targetId' | 'ring'>,
  willLeft: number,
  rules: BattleRules,
): BattleHex[] {
  const target = creatureById(state, strike.targetId);
  if (!target) return [];
  if (!isAdjacentHex(attacker.pos, target.pos)) return strike.ring.map((hex) => ({ ...hex }));
  const nodes = cheapestPaths(state, attacker, rules);
  return strike.ring.filter((hex) => {
    const node = nodes.get(hexKey(hex));
    return !!node && node.cost <= willLeft;
  });
}

function pendingOf(state: BattleState): PendingStrike | undefined {
  const reaction = state.reaction;
  return reaction ? state.pending.find((s) => s.attackerId === reaction.attackerId) : undefined;
}

function resolveAt(
  state: BattleState,
  attacker: BattleCreature,
  fromHex: BattleHex,
  atMs: number,
  rules: BattleRules,
): DomainEvent[] {
  const reaction = state.reaction!;
  const strike = pendingOf(state)!;
  const defender = creatureById(state, reaction.defenderId)!;
  const events: DomainEvent[] = [];
  if (!sameHex(attacker.pos, fromHex) && isAdjacentHex(attacker.pos, defender.pos)) {
    const nodes = cheapestPaths(state, attacker, rules);
    for (const step of pathTo(nodes, fromHex)) {
      events.push(...(moveCreature(state, attacker, step, atMs, rules) as DomainEvent[]));
    }
    state.undo = [];
  }
  const shields = reaction.shields;
  const blocked = shields.some((h) => sameHex(h, fromHex));
  const power = strikePower(state, attacker, defender, reaction.hand, rules);
  const damage = blocked ? 0 : power;
  const weapon = strikingItem(attacker, reaction.hand, rules);
  state.pending = state.pending.filter((s) => s.id !== strike.id);
  state.reaction = undefined;
  if (!blocked) {
    state.wounds[defender.id] = [...(state.wounds[defender.id] ?? []), { ...fromHex }];
  }
  return [
    ...events,
    {
      type: 'STRIKE_LANDED',
      payload: {
        attackerId: attacker.id,
        targetId: defender.id,
        fromHex,
        itemKey: weapon?.key ?? 'unarmed',
        ring: strike.ring,
      },
    },
    {
      type: 'STRIKES_RESOLVED',
      payload: {
        creatureId: defender.id,
        results: [
          {
            strikeId: strike.id,
            attackerId: attacker.id,
            fromHex,
            outcome: blocked ? 'blocked' : 'hit',
            damage,
          },
        ],
        burnedShields: shields,
      },
    },
    ...applyDamage(state, defender, damage),
  ];
}

export function finishBlock(
  state: BattleState,
  defender: BattleCreature,
  atMs: number,
  rules: BattleRules,
): DomainEvent[] | BattleRejection {
  const reaction = state.reaction;
  if (!reaction || reaction.stage !== 'block') return reject('WRONG_PHASE');
  reaction.shields = state.placedShields.map((hex) => ({ ...hex }));
  restoreAttacker(state);
  const attacker = creatureById(state, reaction.attackerId)!;
  const strike = pendingOf(state)!;
  const options =
    reaction.shields.length > 0 ? aimOptions(state, attacker, strike, state.turnWill, rules) : [];
  if (options.length < 2) {
    const only = options[0] ?? strike.fromHex;
    return resolveAt(state, attacker, only, atMs, rules);
  }
  reaction.stage = 'aim';
  reaction.deadlineMs = atMs + rules.blockWindowMs;
  return [
    {
      type: 'REACTION_AIMING',
      payload: {
        attackerId: attacker.id,
        defenderId: defender.id,
        deadlineMs: reaction.deadlineMs,
        options,
        shieldCount: reaction.shields.length,
      },
    },
  ];
}

export function aimStrike(
  state: BattleState,
  attacker: BattleCreature,
  hex: BattleHex,
  atMs: number,
  rules: BattleRules,
): DomainEvent[] | BattleRejection {
  const reaction = state.reaction;
  if (!reaction || reaction.stage !== 'aim') return reject('WRONG_PHASE');
  const strike = pendingOf(state)!;
  const options = aimOptions(state, attacker, strike, state.turnWill, rules);
  if (!options.some((h) => sameHex(h, hex))) return reject('NOT_AN_OPTION');
  return resolveAt(state, attacker, hex, atMs, rules);
}

export function aimTimeout(
  state: BattleState,
  attacker: BattleCreature,
  atMs: number,
  rules: BattleRules,
): DomainEvent[] | BattleRejection {
  const reaction = state.reaction;
  if (!reaction || reaction.stage !== 'aim') return reject('WRONG_PHASE');
  const strike = pendingOf(state)!;
  const options = aimOptions(state, attacker, strike, state.turnWill, rules);
  const stay = options.find((h) => sameHex(h, attacker.pos)) ?? options[0] ?? strike.fromHex;
  return resolveAt(state, attacker, stay, atMs, rules);
}
