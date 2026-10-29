import type { DomainEvent } from '../commands/types';
import type { BattleRules } from './battle-content';
import type { BattleCreature, BattleHex, BattleState, Boulder } from './battle-state';
import {
  creatureById,
  heightAt,
  isAlive,
  isFreeHex,
  terrainAt,
  type BattleBoardView,
} from './battle-board';
import { battleDistance, directionIndex, hexInDirection } from './hex-battle-geom';
import { reject, type BattleRejection } from './battle-rejection';
import { applyDamage } from './battle-end';
import { enterSaw } from './hazard';

export type Displaceable =
  | { kind: 'creature'; id: string; pos: BattleHex; weight: number; creature: BattleCreature }
  | { kind: 'boulder'; id: string; pos: BattleHex; weight: number; boulder: Boulder };

export function findDisplaceable(
  state: BattleBoardView,
  id: string,
  rules: BattleRules,
): Displaceable | null {
  const creature = creatureById(state, id);
  if (creature && isAlive(creature)) {
    return { kind: 'creature', id, pos: creature.pos, weight: creature.weight, creature };
  }
  const boulder = state.boulders.find((b) => b.id === id);
  return boulder
    ? { kind: 'boulder', id, pos: boulder.pos, weight: rules.boulderWeight, boulder }
    : null;
}

export function pushTarget(
  state: BattleState,
  actor: BattleCreature,
  target: Displaceable,
): BattleHex | null {
  const next = hexInDirection(target.pos, directionIndex(actor.pos, target.pos));
  return isFreeHex(state, next) ? next : null;
}

function validateGrip(actor: BattleCreature, target: Displaceable | null): BattleRejection | null {
  if (!target || target.id === actor.id) return reject('NOT_AN_ENEMY');
  if (target.kind === 'creature' && target.creature.side === actor.side)
    return reject('NOT_AN_ENEMY');
  if (battleDistance(actor.pos, target.pos) !== 1) return reject('NOT_ADJACENT');
  if (actor.force < target.weight) return reject('TOO_HEAVY');
  return null;
}

export function validatePush(
  state: BattleState,
  actor: BattleCreature,
  target: Displaceable | null,
): BattleRejection | null {
  const refused = validateGrip(actor, target);
  if (refused) return refused;
  return pushTarget(state, actor, target!) ? null : reject('NO_SPACE');
}

function setPos(target: Displaceable, hex: BattleHex): void {
  if (target.kind === 'creature') target.creature.pos = { ...hex };
  else target.boulder.pos = { ...hex };
}

function slideOnOil(
  state: BattleState,
  target: Displaceable,
  at: BattleHex,
  dir: number,
): BattleHex | null {
  if (terrainAt(state, at) !== 'oil') return null;
  const next = hexInDirection(at, dir);
  return isFreeHex(state, next, target.id) ? next : null;
}

function settle(
  state: BattleState,
  actor: BattleCreature,
  target: Displaceable,
  origin: BattleHex,
  steps: BattleHex[],
  atMs: number,
  rules: BattleRules,
): DomainEvent[] {
  const last = steps[steps.length - 1];
  const slid = slideOnOil(
    state,
    target,
    last,
    directionIndex(steps.length > 1 ? steps[steps.length - 2] : origin, last),
  );
  if (slid) setPos(target, slid);
  const path = slid ? [...steps, slid] : steps;
  const final = path[path.length - 1];
  const fell = heightAt(state, origin) > heightAt(state, final);

  const events: DomainEvent[] = [
    {
      type: 'DISPLACED',
      payload: { targetId: target.id, mode: 'push', from: origin, path, slid: !!slid, fell },
    },
  ];
  if (target.kind !== 'creature') return events;
  if (fell) events.push(...applyDamage(state, target.creature, rules.fallDamage));
  if (!isAlive(target.creature) || terrainAt(state, final) !== 'saw') return events;
  const backHex = path.length > 1 ? path[path.length - 2] : origin;
  return [...events, ...enterSaw(state, target.creature, backHex, actor.pos, atMs, rules)];
}

export function resolvePush(
  state: BattleState,
  actor: BattleCreature,
  target: Displaceable,
  atMs: number,
  rules: BattleRules,
): DomainEvent[] {
  const origin = { ...target.pos };
  const first = pushTarget(state, actor, target);
  if (!first)
    return [{ type: 'DISPLACE_FAILED', payload: { targetId: target.id, reason: 'NO_SPACE' } }];
  setPos(target, first);
  return settle(state, actor, target, origin, [first], atMs, rules);
}
