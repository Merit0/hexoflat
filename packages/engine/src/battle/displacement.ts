import type { DomainEvent } from '../commands/types';
import type { BattleRules } from './battle-content';
import type { BattleCreature, BattleHex, BattleState, Boulder } from './battle-state';
import { creatureById, heightAt, isAlive, isFreeHex, terrainAt } from './battle-board';
import {
  battleDistance,
  directionIndex,
  hexInDirection,
  hexKey,
  hexNeighbours,
  isAdjacentHex,
} from './hex-battle-geom';
import { reject, type BattleRejection } from './battle-rejection';
import { applyDamage } from './battle-end';
import { enterSaw } from './hazard';

export type DisplaceMode = 'push' | 'pull';

export type Displaceable =
  | { kind: 'creature'; id: string; pos: BattleHex; weight: number; creature: BattleCreature }
  | { kind: 'boulder'; id: string; pos: BattleHex; weight: number; boulder: Boulder };

export function findDisplaceable(
  state: BattleState,
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

export function displacementTarget(
  state: BattleState,
  actor: BattleCreature,
  target: Displaceable,
  mode: DisplaceMode,
): BattleHex | null {
  if (mode === 'push') {
    const next = hexInDirection(target.pos, directionIndex(actor.pos, target.pos));
    return isFreeHex(state, next) ? next : null;
  }
  const shared = hexNeighbours(actor.pos)
    .filter((hex) => isAdjacentHex(hex, target.pos) && isFreeHex(state, hex))
    .sort((a, b) => hexKey(a).localeCompare(hexKey(b)));
  return shared[0] ?? null;
}

export function validateDisplacement(
  state: BattleState,
  actor: BattleCreature,
  target: Displaceable | null,
  mode: DisplaceMode,
  rules: BattleRules,
): BattleRejection | null {
  if (!target || target.id === actor.id) return reject('NOT_AN_ENEMY');
  if (target.kind === 'creature' && target.creature.side === actor.side)
    return reject('NOT_AN_ENEMY');
  const range = mode === 'push' ? 1 : rules.pullRange;
  if (battleDistance(actor.pos, target.pos) !== range) {
    return reject(mode === 'push' ? 'NOT_ADJACENT' : 'OUT_OF_RANGE');
  }
  if (actor.force < target.weight) return reject('TOO_HEAVY');
  if (!displacementTarget(state, actor, target, mode)) return reject('NO_SPACE');
  return null;
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

export function resolveDisplacement(
  state: BattleState,
  actor: BattleCreature,
  target: Displaceable,
  mode: DisplaceMode,
  atMs: number,
  rules: BattleRules,
): DomainEvent[] {
  const origin = { ...target.pos };
  const first = displacementTarget(state, actor, target, mode);
  if (!first)
    return [{ type: 'DISPLACE_FAILED', payload: { targetId: target.id, reason: 'NO_SPACE' } }];
  setPos(target, first);
  const slid = slideOnOil(state, target, first, directionIndex(origin, first));
  if (slid) setPos(target, slid);
  const path = slid ? [first, slid] : [first];
  const final = path[path.length - 1];
  const fell = heightAt(state, origin) > heightAt(state, final);

  const events: DomainEvent[] = [
    {
      type: 'DISPLACED',
      payload: { targetId: target.id, mode, from: origin, path, slid: !!slid, fell },
    },
  ];
  if (target.kind !== 'creature') return events;
  if (fell) events.push(...applyDamage(state, target.creature, rules.fallDamage));
  if (!isAlive(target.creature) || terrainAt(state, final) !== 'saw') return events;
  const backHex = path.length > 1 ? path[0] : origin;
  return [...events, ...enterSaw(state, target.creature, backHex, actor.pos, atMs, rules)];
}
