import type { BattleRules } from '../battle-content';
import type { BattleAction } from '../battle-commands';
import type { BattleCreature, BattleHand, BattleHex } from '../battle-state';
import { creatureById, freeNeighbours, livingOnSide, terrainAt } from '../battle-board';
import { shieldCapacity } from '../defend';
import { battleDistance, hexKey, isAdjacentHex, parseHexKey, sameHex } from '../hex-battle-geom';
import { cheapestPaths, pathTo, stepCost } from '../movement';
import type { BattleProjection } from '../projection';

export function activeSelf(view: BattleProjection): BattleCreature {
  return creatureById(view, view.activeId)!;
}

export function opponents(view: BattleProjection, self: BattleCreature): BattleCreature[] {
  return livingOnSide(view, self.side === 'heroes' ? 'enemies' : 'heroes');
}

export function readyHand(view: BattleProjection, self: BattleCreature): BattleHand | null {
  const hands: BattleHand[] = ['right', 'left'];
  return hands.find((h) => self.hands[h]?.power && !view.struckHands.includes(h)) ?? null;
}

export function weakestFirst(creatures: BattleCreature[]): BattleCreature[] {
  return [...creatures].sort((a, b) => a.hp - b.hp || a.id.localeCompare(b.id));
}

export function distanceToFoes(
  view: BattleProjection,
  self: BattleCreature,
  hex: BattleHex,
): number {
  return Math.min(...opponents(view, self).map((foe) => battleDistance(foe.pos, hex)));
}

export function adjacentFoes(view: BattleProjection, self: BattleCreature): BattleCreature[] {
  return weakestFirst(opponents(view, self).filter((foe) => isAdjacentHex(foe.pos, self.pos)));
}

function affordableSteps(
  view: BattleProjection,
  self: BattleCreature,
  rules: BattleRules,
): BattleHex[] {
  return freeNeighbours(view, self.pos)
    .filter((hex) => terrainAt(view, hex) !== 'saw')
    .filter((hex) => stepCost(view, self.pos, hex, rules) <= view.turnWill);
}

export function retreatStep(
  view: BattleProjection,
  self: BattleCreature,
  rules: BattleRules,
  accept: (hex: BattleHex) => boolean = () => true,
): BattleAction | null {
  if (view.undo.length > 0) return null;
  const here = distanceToFoes(view, self, self.pos);
  const away = (hex: BattleHex) => distanceToFoes(view, self, hex);
  const options = affordableSteps(view, self, rules)
    .filter((hex) => away(hex) > here && accept(hex))
    .sort((a, b) => away(b) - away(a) || hexKey(a).localeCompare(hexKey(b)));
  return options[0] ? { kind: 'move', hex: options[0] } : null;
}

export function approachStep(
  view: BattleProjection,
  self: BattleCreature,
  rules: BattleRules,
  isGoal: (hex: BattleHex) => boolean,
): BattleAction | null {
  if (isGoal(self.pos)) return null;
  const nodes = cheapestPaths(view, self, rules);
  const goals = [...nodes.keys()]
    .filter((key) => isGoal(parseHexKey(key)))
    .sort((a, b) => nodes.get(a)!.cost - nodes.get(b)!.cost || a.localeCompare(b));
  const path = goals[0] ? pathTo(nodes, parseHexKey(goals[0])) : [];
  if (!path.length) return null;
  const cost = stepCost(view, self.pos, path[0], rules);
  const reserve = rules.strike + rules.step.floor;
  return view.turnWill - cost >= reserve ? { kind: 'move', hex: path[0] } : null;
}

function shieldRank(standing: BattleHex, ring: BattleHex[], from: BattleHex): number {
  const order = [...ring].sort(
    (a, b) =>
      battleDistance(standing, a) - battleDistance(standing, b) ||
      hexKey(a).localeCompare(hexKey(b)),
  );
  return order.findIndex((hex) => sameHex(hex, from));
}

export function hideStep(
  view: BattleProjection,
  self: BattleCreature,
  rules: BattleRules,
): BattleAction | null {
  const own = view.pending.filter((s) => s.attackerId === self.id && s.fromHex);
  if (!own.length) return retreatStep(view, self, rules);
  const nodes = cheapestPaths(view, self, rules);
  const score = (key: string) => {
    const hex = parseHexKey(key);
    return Math.min(...own.map((s) => shieldRank(hex, s.ring, s.fromHex!)));
  };
  const away = (key: string) => distanceToFoes(view, self, parseHexKey(key));
  const best = [...nodes.keys()]
    .filter((key) => nodes.get(key)!.cost <= view.turnWill)
    .sort(
      (a, b) =>
        score(b) - score(a) ||
        away(b) - away(a) ||
        nodes.get(a)!.cost - nodes.get(b)!.cost ||
        a.localeCompare(b),
    )[0];
  if (!best || best === hexKey(self.pos)) return null;
  return { kind: 'move', hex: pathTo(nodes, parseHexKey(best))[0] };
}

function shieldCandidates(view: BattleProjection, self: BattleCreature): BattleHex[] {
  const placed = view.placedShields;
  return view.pending
    .filter((strike) => strike.targetId === self.id)
    .flatMap((strike) => strike.ring)
    .filter((hex, i, all) => all.findIndex((h) => sameHex(h, hex)) === i)
    .filter((hex) => !placed.some((p) => sameHex(p, hex)))
    .sort(
      (a, b) =>
        distanceToFoes(view, self, a) - distanceToFoes(view, self, b) ||
        hexKey(a).localeCompare(hexKey(b)),
    );
}

export function defendAction(
  view: BattleProjection,
  self: BattleCreature,
  rules: BattleRules,
): BattleAction {
  const placed = view.placedShields.length;
  const canShield = shieldCapacity(self, rules) > placed && view.turnWill >= rules.shieldPerSide;
  const next = canShield ? shieldCandidates(view, self)[0] : undefined;
  if (next) return { kind: 'place-shield', hex: next };
  return placed ? { kind: 'confirm-block' } : { kind: 'take-hit' };
}
