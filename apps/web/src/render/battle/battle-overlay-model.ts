import type { BattleRules } from '@hexoflat/engine/battle/battle-content';
import type { BattleCreature, BattleHex } from '@hexoflat/engine/battle/battle-state';
import type { BattleProjection } from '@hexoflat/engine/battle/projection';
import { creatureById, livingOnSide, terrainAt } from '@hexoflat/engine/battle/battle-board';
import {
  battleDistance,
  hexKey,
  hexNeighbours,
  isAdjacentHex,
  parseHexKey,
} from '@hexoflat/engine/battle/hex-battle-geom';
import { cheapestPaths, stepCost } from '@hexoflat/engine/battle/movement';
import type { DeploymentZones } from '@hexoflat/engine/encounters/battlefield-setup';
import type { BattleOverlayTone } from './battle-look';

export type BattleTargetMode = 'move' | 'strike' | 'push' | 'pull';

export interface BattleMark {
  hex: BattleHex;
  tone: BattleOverlayTone;
  label?: string;
}

export interface BattleBadge {
  hex: BattleHex;
  text: string;
}

export interface DefendResultMark {
  fromHex: BattleHex;
  outcome: 'blocked' | 'hit' | 'dodged';
}

export interface BattleOverlayInput {
  projection: BattleProjection | null;
  zones: DeploymentZones | null;
  mode: BattleTargetMode | null;
  results: DefendResultMark[];
}

export interface BattleOverlayModel {
  marks: BattleMark[];
  badges: BattleBadge[];
  targets: string[];
}

function activeHero(view: BattleProjection): BattleCreature | null {
  const active = creatureById(view, view.activeId);
  return active && active.side === view.viewer && view.phase === 'act' && !view.task
    ? active
    : null;
}

function movementMarks(
  view: BattleProjection,
  self: BattleCreature,
  rules: BattleRules,
): BattleMark[] {
  const nodes = cheapestPaths(view, self, rules);
  const marks: BattleMark[] = [];
  const danger = new Set<string>();
  for (const [key, node] of nodes) {
    if (key === hexKey(self.pos) || node.cost > view.turnWill) continue;
    marks.push({ hex: parseHexKey(key), tone: 'reachable', label: `${node.cost} WILL` });
  }
  for (const [key, node] of nodes) {
    const from = parseHexKey(key);
    for (const next of hexNeighbours(from)) {
      if (terrainAt(view, next) !== 'saw' || danger.has(hexKey(next))) continue;
      if (node.cost + stepCost(view, from, next, rules) > view.turnWill) continue;
      danger.add(hexKey(next));
      marks.push({ hex: next, tone: 'danger', label: 'DANGER' });
    }
  }
  return marks;
}

function targetCreatures(
  view: BattleProjection,
  self: BattleCreature,
  mode: BattleTargetMode,
): BattleCreature[] {
  const foes = livingOnSide(view, self.side === 'heroes' ? 'enemies' : 'heroes');
  const range = self.hands.right?.range ?? self.hands.left?.range;
  const reachable = (foe: BattleCreature) => {
    const d = battleDistance(self.pos, foe.pos);
    if (mode === 'pull') return d === 2 && self.force >= foe.weight;
    if (mode === 'push') return d === 1 && self.force >= foe.weight;
    return range ? d >= range.min && d <= range.max : isAdjacentHex(self.pos, foe.pos);
  };
  return foes.filter(reachable);
}

function zoneMarks(zones: DeploymentZones): BattleMark[] {
  return [
    ...zones.heroes.map((hex) => ({ hex, tone: 'heroZone' as const })),
    ...zones.enemies.map((hex) => ({ hex, tone: 'enemyZone' as const })),
  ];
}

function strikeMarks(view: BattleProjection): BattleMark[] {
  const own = new Set(livingOnSide(view, view.viewer).map((c) => c.id));
  return view.pending
    .filter((strike) => own.has(strike.targetId))
    .flatMap((strike) => strike.ring.map((hex) => ({ hex, tone: 'ring' as const })));
}

function pendingBadges(view: BattleProjection): BattleBadge[] {
  const counts = new Map<string, number>();
  for (const strike of view.pending)
    counts.set(strike.targetId, (counts.get(strike.targetId) ?? 0) + 1);
  return [...counts].flatMap(([id, n]) => {
    const target = creatureById(view, id);
    return target ? [{ hex: target.pos, text: `×${n}` }] : [];
  });
}

export function battleOverlayModel(
  input: BattleOverlayInput,
  rules: BattleRules,
): BattleOverlayModel {
  const marks: BattleMark[] = input.zones ? zoneMarks(input.zones) : [];
  const view = input.projection;
  if (!view) return { marks, badges: [], targets: [] };

  marks.push(...strikeMarks(view));
  marks.push(...view.placedShields.map((hex) => ({ hex, tone: 'shield' as const })));
  const hero = activeHero(view);
  if (hero && input.mode === 'move') marks.push(...movementMarks(view, hero, rules));
  const targets =
    hero && input.mode && input.mode !== 'move' ? targetCreatures(view, hero, input.mode) : [];
  marks.push(...targets.map((foe) => ({ hex: foe.pos, tone: 'target' as const })));
  marks.push(...input.results.map((r) => ({ hex: r.fromHex, tone: r.outcome })));
  return { marks, badges: pendingBadges(view), targets: targets.map((foe) => foe.id) };
}
