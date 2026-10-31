import type { BattleRules } from '../battle-content';
import type { BattleAction } from '../battle-commands';
import type { BattleCreature, BattleHand, BattleHex } from '../battle-state';
import { creatureById, freeNeighbours, livingOnSide, terrainAt } from '../battle-board';
import { shieldCapacity } from '../defend';
import { aimOptions } from '../reaction';
import { reachableRing } from '../strike';
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
  const free = (['right', 'left'] as BattleHand[]).filter((h) => !view.struckHands.includes(h));
  return free.find((h) => self.hands[h]?.power) ?? free.find((h) => !self.hands[h]) ?? null;
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

export function reachableFoes(
  view: BattleProjection,
  self: BattleCreature,
  rules: BattleRules,
): BattleCreature[] {
  const willLeft = view.turnWill - rules.strike;
  return weakestFirst(
    opponents(view, self).filter(
      (foe) =>
        reachableRing(view, self, freeNeighbours(view, foe.pos, self.id), willLeft, rules).length >
        0,
    ),
  );
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
      (a, b) => shieldGuess(view, a) - shieldGuess(view, b) || hexKey(a).localeCompare(hexKey(b)),
    );
}

function shieldGuess(view: BattleProjection, hex: BattleHex): number {
  let hash = view.strikeSeq * 2654435761;
  for (const char of hexKey(hex)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 9973;
}

export function defendAction(
  view: BattleProjection,
  self: BattleCreature,
  rules: BattleRules,
): BattleAction {
  const placed = view.placedShields.length;
  const canShield = shieldCapacity(self, rules) > placed;
  const next = canShield ? shieldCandidates(view, self)[0] : undefined;
  if (next) return { kind: 'place-shield', hex: next };
  return placed ? { kind: 'reaction-timeout' } : { kind: 'take-hit' };
}

export function aimAction(
  view: BattleProjection,
  self: BattleCreature,
  rules: BattleRules,
): BattleAction | null {
  if (view.reaction?.stage !== 'aim' || view.reaction.attackerId !== self.id) return null;
  const strike = view.pending.find((s) => s.attackerId === self.id);
  if (!strike) return null;
  const options = aimOptions(view, self, strike, view.turnWill, rules, view.reaction.ranged);
  if (!options.length) return { kind: 'reaction-timeout' };
  return { kind: 'aim', hex: options[(view.strikeSeq + view.round) % options.length] };
}
