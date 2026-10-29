import type { BattleRules } from '@hexoflat/engine/battle/battle-content';
import type { BattleAction } from '@hexoflat/engine/battle/battle-commands';
import type { BattleCreature, BattleHex } from '@hexoflat/engine/battle/battle-state';
import { creatureById, livingCreatureAt, terrainAt } from '@hexoflat/engine/battle/battle-board';
import { hexKey, hexNeighbours, sameHex } from '@hexoflat/engine/battle/hex-battle-geom';
import { cheapestPaths, pathTo, stepCost } from '@hexoflat/engine/battle/movement';
import type { BattleProjection } from '@hexoflat/engine/battle/projection';

export type BattleUiMode = 'move' | 'strike' | 'push' | 'pull' | 'swap';

export interface BattleTapInput {
  projection: BattleProjection | null;
  localHeroIds: readonly string[];
  mode: BattleUiMode;
  hex: BattleHex;
  rules: BattleRules;
}

export function controlledHero(
  view: BattleProjection | null,
  localHeroIds: readonly string[],
): BattleCreature | null {
  if (!view || view.task || view.phase === 'ended') return null;
  const active = creatureById(view, view.activeId);
  return active && localHeroIds.includes(active.id) ? active : null;
}

function defendTap(view: BattleProjection, self: BattleCreature, hex: BattleHex): BattleAction[] {
  if (view.placedShields.some((h) => sameHex(h, hex))) return [{ kind: 'remove-shield', hex }];
  const inRing = view.pending
    .filter((s) => s.targetId === self.id)
    .some((s) => s.ring.some((h) => sameHex(h, hex)));
  return inRing ? [{ kind: 'place-shield', hex }] : [];
}

export interface BattleMoveRoute {
  path: BattleHex[];
  cost: number;
}

export interface BattleMovePreview extends BattleMoveRoute {
  reachable: boolean;
}

function cheapestRoute(
  view: BattleProjection,
  self: BattleCreature,
  hex: BattleHex,
  rules: BattleRules,
): BattleMoveRoute | null {
  if (sameHex(self.pos, hex)) return null;
  const nodes = cheapestPaths(view, self, rules);
  const direct = nodes.get(hexKey(hex));
  if (direct) return { path: pathTo(nodes, hex), cost: direct.cost };
  if (terrainAt(view, hex) !== 'saw' || livingCreatureAt(view, hex)) return null;
  let best: BattleMoveRoute | null = null;
  for (const from of hexNeighbours(hex)) {
    const node = nodes.get(hexKey(from));
    if (!node) continue;
    const cost = node.cost + stepCost(view, from, hex, rules);
    if (!best || cost < best.cost) best = { path: [...pathTo(nodes, from), hex], cost };
  }
  return best;
}

function stepsTo(
  view: BattleProjection,
  self: BattleCreature,
  hex: BattleHex,
  rules: BattleRules,
): BattleHex[] {
  const route = cheapestRoute(view, self, hex, rules);
  return route && route.cost <= view.turnWill ? route.path : [];
}

export function battleMovePreview(input: BattleTapInput): BattleMovePreview | null {
  const view = input.projection;
  const self = controlledHero(view, input.localHeroIds);
  if (!view || !self || view.phase !== 'act' || input.mode !== 'move') return null;
  const route = cheapestRoute(view, self, input.hex, input.rules);
  return route ? { ...route, reachable: route.cost <= view.turnWill } : null;
}

function targetTap(view: BattleProjection, input: BattleTapInput): BattleAction[] {
  const target = livingCreatureAt(view, input.hex);
  if (!target || target.side === view.viewer) return [];
  if (input.mode === 'push' || input.mode === 'pull')
    return [{ kind: input.mode, targetId: target.id }];
  return [];
}

export function battleTapActions(input: BattleTapInput): BattleAction[] {
  const view = input.projection;
  const self = controlledHero(view, input.localHeroIds);
  if (!view || !self) return [];
  if (view.phase === 'defend') return defendTap(view, self, input.hex);
  if (input.mode === 'move') {
    return stepsTo(view, self, input.hex, input.rules).map((hex) => ({ kind: 'move', hex }));
  }
  return targetTap(view, input);
}
