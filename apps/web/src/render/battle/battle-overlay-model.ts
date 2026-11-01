import type { BattleCreature, BattleHex } from '@hexoflat/engine/battle/battle-state';
import type { BattleProjection } from '@hexoflat/engine/battle/projection';
import {
  creatureById,
  freeNeighbours,
  isAlive,
  livingOnSide,
} from '@hexoflat/engine/battle/battle-board';
import { battleDistance } from '@hexoflat/engine/battle/hex-battle-geom';
import type { DeploymentZones } from '@hexoflat/engine/battle/battlefield-setup';
import { aimOptions } from '@hexoflat/engine/battle/reaction';
import { reachableRing } from '@hexoflat/engine/battle/strike';
import { BATTLE_RULES } from '@hexoflat/engine/battle/battle-content';
import type { BattleOverlayTone } from './battle-look';

export type BattleTargetMode = 'move' | 'strike' | 'push';

export interface BattleMark {
  hex: BattleHex;
  tone: BattleOverlayTone;
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
  revealed?: readonly BattleHex[];
  selectedId?: string | null;
}

export interface BattleOverlayModel {
  marks: BattleMark[];
  targets: string[];
}

function activeHero(view: BattleProjection): BattleCreature | null {
  const active = creatureById(view, view.activeId);
  return active && active.side === view.viewer && view.phase === 'act' && !view.task
    ? active
    : null;
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
    if (mode === 'push') return d === 1 && self.force >= foe.weight;
    if (range) return d >= range.min && d <= range.max;
    const ring = freeNeighbours(view, foe.pos, self.id);
    return (
      reachableRing(view, self, ring, view.turnWill - BATTLE_RULES.strike, BATTLE_RULES).length > 0
    );
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

function decoyShieldMarks(view: BattleProjection): BattleMark[] {
  if (!view.shieldsRaised) return [];
  const own = new Set(livingOnSide(view, view.viewer).map((c) => c.id));
  return view.pending
    .filter((strike) => own.has(strike.attackerId))
    .flatMap((strike) => strike.ring.map((hex) => ({ hex, tone: 'shield' as const })));
}

function aimMarks(view: BattleProjection): BattleMark[] {
  const self = activeHero(view);
  const strike = self ? view.pending.find((s) => s.attackerId === self.id) : undefined;
  if (!self || !strike || view.reaction?.stage !== 'aim') return [];
  return aimOptions(view, self, strike, view.turnWill, BATTLE_RULES, view.reaction.ranged).map(
    (hex) => ({
      hex,
      tone: 'target' as const,
    }),
  );
}

function selectedFoeDecoys(
  view: BattleProjection,
  hero: BattleCreature,
  foe: BattleCreature,
): BattleMark[] {
  const guarded =
    (foe.hands.right?.shieldCapacity ?? 0) + (foe.hands.left?.shieldCapacity ?? 0) > 0;
  const ranged = !!(hero.hands.right?.range ?? hero.hands.left?.range);
  if (!guarded || ranged || view.reaction) return [];
  return freeNeighbours(view, foe.pos, hero.id).map((hex) => ({ hex, tone: 'shield' as const }));
}

export function battleOverlayModel(input: BattleOverlayInput): BattleOverlayModel {
  const marks: BattleMark[] = input.zones ? zoneMarks(input.zones) : [];
  const view = input.projection;
  if (!view) return { marks, targets: [] };

  marks.push(...strikeMarks(view), ...aimMarks(view), ...decoyShieldMarks(view));
  marks.push(...view.placedShields.map((hex) => ({ hex, tone: 'shield' as const })));
  const hero = activeHero(view);
  const targets =
    hero && input.mode && input.mode !== 'move' ? targetCreatures(view, hero, input.mode) : [];
  marks.push(...targets.map((foe) => ({ hex: foe.pos, tone: 'target' as const })));
  const selected = input.selectedId ? creatureById(view, input.selectedId) : null;
  if (selected && isAlive(selected) && selected.side !== view.viewer && view.phase !== 'ended') {
    marks.push({ hex: selected.pos, tone: 'selected' });
    if (hero && !input.revealed?.length) marks.push(...selectedFoeDecoys(view, hero, selected));
  }
  marks.push(...(input.revealed ?? []).map((hex) => ({ hex, tone: 'shield' as const })));
  marks.push(...input.results.map((r) => ({ hex: r.fromHex, tone: r.outcome })));
  return { marks, targets: targets.map((foe) => foe.id) };
}
