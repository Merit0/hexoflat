import type { BattleCreature, BattleHex } from '@hexoflat/engine/battle/battle-state';
import type { BattleProjection } from '@hexoflat/engine/battle/projection';
import { creatureById, livingOnSide } from '@hexoflat/engine/battle/battle-board';
import { battleDistance, isAdjacentHex } from '@hexoflat/engine/battle/hex-battle-geom';
import type { DeploymentZones } from '@hexoflat/engine/battle/battlefield-setup';
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

export function battleOverlayModel(input: BattleOverlayInput): BattleOverlayModel {
  const marks: BattleMark[] = input.zones ? zoneMarks(input.zones) : [];
  const view = input.projection;
  if (!view) return { marks, targets: [] };

  marks.push(...strikeMarks(view));
  const guards = Object.values(view.guards).flat();
  marks.push(
    ...[...view.placedShields, ...guards].map((hex) => ({ hex, tone: 'shield' as const })),
  );
  const hero = activeHero(view);
  const targets =
    hero && input.mode && input.mode !== 'move' ? targetCreatures(view, hero, input.mode) : [];
  marks.push(...targets.map((foe) => ({ hex: foe.pos, tone: 'target' as const })));
  marks.push(...input.results.map((r) => ({ hex: r.fromHex, tone: r.outcome })));
  return { marks, targets: targets.map((foe) => foe.id) };
}
