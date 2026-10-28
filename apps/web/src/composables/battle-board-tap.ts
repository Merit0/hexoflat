import type { BattleRules } from '@hexoflat/engine/battle/battle-content';
import type { BattleAction } from '@hexoflat/engine/battle/battle-commands';
import type { BattleCreature, BattleHand, BattleHex } from '@hexoflat/engine/battle/battle-state';
import { creatureById, livingCreatureAt, terrainAt } from '@hexoflat/engine/battle/battle-board';
import { hexKey, hexNeighbours, sameHex } from '@hexoflat/engine/battle/hex-battle-geom';
import { cheapestPaths, pathTo, stepCost } from '@hexoflat/engine/battle/movement';
import type { BattleProjection } from '@hexoflat/engine/battle/projection';

export type BattleUiMode = 'move' | 'strike' | 'push' | 'pull' | 'swap';

export interface BattleTapInput {
  projection: BattleProjection | null;
  localHeroIds: readonly string[];
  mode: BattleUiMode;
  hand: BattleHand | null;
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

function stepsTo(
  view: BattleProjection,
  self: BattleCreature,
  hex: BattleHex,
  rules: BattleRules,
): BattleHex[] {
  const nodes = cheapestPaths(view, self, rules);
  const direct = nodes.get(hexKey(hex));
  if (direct) return direct.cost <= view.turnWill ? pathTo(nodes, hex) : [];
  if (terrainAt(view, hex) !== 'saw' || livingCreatureAt(view, hex)) return [];
  let best: { path: BattleHex[]; cost: number } | null = null;
  for (const from of hexNeighbours(hex)) {
    const node = nodes.get(hexKey(from));
    if (!node) continue;
    const cost = node.cost + stepCost(view, from, hex, rules);
    if (cost <= view.turnWill && (!best || cost < best.cost))
      best = { path: [...pathTo(nodes, from), hex], cost };
  }
  return best?.path ?? [];
}

function targetTap(view: BattleProjection, input: BattleTapInput): BattleAction[] {
  const target = livingCreatureAt(view, input.hex);
  if (!target || target.side === view.viewer) return [];
  if (input.mode === 'strike' && input.hand)
    return [{ kind: 'strike', targetId: target.id, hand: input.hand }];
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
