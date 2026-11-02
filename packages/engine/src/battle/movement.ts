import type { DomainEvent } from '../commands/types';
import type { BattleRules } from './battle-content';
import type { BattleCreature, BattleHex, BattleState } from './battle-state';
import { heightAt, isFreeHex, terrainAt, type BattleBoardView } from './battle-board';
import { hexKey, hexNeighbours, isAdjacentHex, parseHexKey } from './hex-battle-geom';
import { reject, spendTurnWill, type BattleRejection } from './battle-rejection';
import { enterSaw } from './hazard';
import { endTurnIfActiveFell } from './turn';

export function stepCost(
  state: BattleBoardView,
  from: BattleHex,
  to: BattleHex,
  rules: BattleRules,
): number {
  if (terrainAt(state, to) === 'rubble') return rules.step.rubble;
  const rise = heightAt(state, to) - heightAt(state, from);
  if (rise > 0) return rules.step.climb;
  if (rise < 0) return rules.step.descend;
  return rules.step.floor;
}

export function moveCreature(
  state: BattleState,
  mover: BattleCreature,
  hex: BattleHex,
  atMs: number,
  rules: BattleRules,
): DomainEvent[] | BattleRejection {
  if (!isAdjacentHex(mover.pos, hex)) return reject('NOT_ADJACENT');
  if (!isFreeHex(state, hex)) return reject('HEX_BLOCKED');

  const cost = stepCost(state, mover.pos, hex, rules);
  const refused = spendTurnWill(state, cost);
  if (refused) return refused;

  const from = mover.pos;
  mover.pos = { ...hex };
  state.undo.push({ from, to: { ...hex }, cost });
  const moved: DomainEvent = {
    type: 'CREATURE_MOVED',
    payload: { creatureId: mover.id, from, to: mover.pos, cost, willLeft: state.turnWill },
  };
  if (terrainAt(state, hex) !== 'saw') return [moved];
  state.undo = [];
  return [
    moved,
    ...enterSaw(state, mover, from, undefined, atMs, rules),
    ...endTurnIfActiveFell(state, rules),
  ];
}

export function undoStep(
  state: BattleState,
  mover: BattleCreature,
): DomainEvent[] | BattleRejection {
  const last = state.undo.pop();
  if (!last) return reject('NOTHING_TO_UNDO');
  mover.pos = { ...last.from };
  state.turnWill += last.cost;
  return [
    {
      type: 'MOVE_UNDONE',
      payload: { creatureId: mover.id, from: last.to, to: last.from, refund: last.cost },
    },
  ];
}

export interface PathNode {
  cost: number;
  prev: string | null;
}

export function cheapestPaths(
  state: BattleBoardView,
  mover: BattleCreature,
  rules: BattleRules,
): Map<string, PathNode> {
  const nodes = new Map<string, PathNode>([[hexKey(mover.pos), { cost: 0, prev: null }]]);
  const open = [hexKey(mover.pos)];
  while (open.length) {
    open.sort((a, b) => nodes.get(a)!.cost - nodes.get(b)!.cost || a.localeCompare(b));
    const currentKey = open.shift()!;
    const current = parseHexKey(currentKey);
    for (const next of hexNeighbours(current)) {
      if (!isFreeHex(state, next, mover.id) || terrainAt(state, next) === 'saw') continue;
      const cost = nodes.get(currentKey)!.cost + stepCost(state, current, next, rules);
      const known = nodes.get(hexKey(next));
      if (known && known.cost <= cost) continue;
      nodes.set(hexKey(next), { cost, prev: currentKey });
      open.push(hexKey(next));
    }
  }
  return nodes;
}

export function pathTo(nodes: Map<string, PathNode>, target: BattleHex): BattleHex[] {
  let key = hexKey(target);
  if (!nodes.has(key)) return [];
  const path: BattleHex[] = [];
  let prev = nodes.get(key)!.prev;
  while (prev !== null) {
    path.unshift(parseHexKey(key));
    key = prev;
    prev = nodes.get(key)!.prev;
  }
  return path;
}
