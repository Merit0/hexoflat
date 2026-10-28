import type { BattleRules } from '../battle-content';
import type { BattleAction } from '../battle-commands';
import type { BattleCreature, BattleHand, BattleHex } from '../battle-state';
import { creatureById, freeNeighbours, livingOnSide, terrainAt } from '../battle-board';
import { battleDistance, hexKey, isAdjacentHex } from '../hex-battle-geom';
import { cheapestPaths, pathTo, stepCost } from '../movement';
import type { BattleProjection } from '../projection';

function readyHand(view: BattleProjection, self: BattleCreature): BattleHand | null {
  const hands: BattleHand[] = ['right', 'left'];
  return hands.find((h) => self.hands[h]?.power && !view.struckHands.includes(h)) ?? null;
}

function distanceToHeroes(view: BattleProjection, hex: BattleHex): number {
  return Math.min(...livingOnSide(view, 'heroes').map((h) => battleDistance(h.pos, hex)));
}

function adjacentHeroTarget(view: BattleProjection, self: BattleCreature): BattleCreature | null {
  const near = livingOnSide(view, 'heroes').filter((h) => isAdjacentHex(h.pos, self.pos));
  near.sort((a, b) => a.hp - b.hp || a.id.localeCompare(b.id));
  return near[0] ?? null;
}

function retreatStep(
  view: BattleProjection,
  self: BattleCreature,
  rules: BattleRules,
): BattleAction | null {
  if (view.undo.length > 0) return null;
  const here = distanceToHeroes(view, self.pos);
  const options = freeNeighbours(view, self.pos)
    .filter((hex) => terrainAt(view, hex) !== 'saw')
    .filter((hex) => stepCost(view, self.pos, hex, rules) <= view.turnWill)
    .filter((hex) => distanceToHeroes(view, hex) > here)
    .sort(
      (a, b) =>
        distanceToHeroes(view, b) - distanceToHeroes(view, a) || hexKey(a).localeCompare(hexKey(b)),
    );
  return options[0] ? { kind: 'move', hex: options[0] } : null;
}

function approachStep(
  view: BattleProjection,
  self: BattleCreature,
  rules: BattleRules,
): BattleAction | null {
  const nodes = cheapestPaths(view, self, rules);
  const goals = livingOnSide(view, 'heroes')
    .flatMap((hero) => freeNeighbours(view, hero.pos, self.id))
    .filter((hex) => nodes.has(hexKey(hex)))
    .sort(
      (a, b) =>
        nodes.get(hexKey(a))!.cost - nodes.get(hexKey(b))!.cost ||
        hexKey(a).localeCompare(hexKey(b)),
    );
  const path = goals[0] ? pathTo(nodes, goals[0]) : [];
  if (!path.length) return null;
  const first = path[0];
  return stepCost(view, self.pos, first, rules) <= view.turnWill
    ? { kind: 'move', hex: first }
    : null;
}

export function nextPlaceholderAction(view: BattleProjection, rules: BattleRules): BattleAction {
  const self = creatureById(view, view.activeId)!;
  if (view.phase === 'defend') return { kind: 'take-hit' };
  if (view.struckHands.length > 0) return retreatStep(view, self, rules) ?? { kind: 'end-turn' };

  const hand = readyHand(view, self);
  const target = adjacentHeroTarget(view, self);
  if (target && hand) {
    return view.turnWill >= rules.strike
      ? { kind: 'strike', targetId: target.id, hand }
      : { kind: 'end-turn' };
  }
  return approachStep(view, self, rules) ?? { kind: 'end-turn' };
}
