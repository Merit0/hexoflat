import type { DomainEvent } from '@hexoflat/engine/commands/types';
import type { BattleRules } from '@hexoflat/engine/battle/battle-content';
import { behaviourOf } from '@hexoflat/engine/battle/battle-catalogue';
import type { BattleCreature } from '@hexoflat/engine/battle/battle-state';
import { creatureById, isAlive } from '@hexoflat/engine/battle/battle-board';
import type { BattleProjection } from '@hexoflat/engine/battle/projection';
import type { BattleBannerProps } from '@/render/battle/battle-banner';
import {
  battleOverlayModel,
  type BattleOverlayModel,
  type DefendResultMark,
} from '@/render/battle/battle-overlay-model';
import type { BattleBoardScene } from '@/render/battle/use-battle-board';
import type { NameOf } from './battle-hint';
import { controlledHero } from './battle-board-tap';
import { buildHeroCard, type BattleHeroCard } from './battle-hero-card';
import type { BattleCreatureRow, BattleRowTag, BattleViewInput } from './battle-view-types';

export interface BattleInitChip {
  id: string;
  num: number;
  name: string;
  side: BattleCreature['side'];
  state: 'active' | 'done' | 'wait' | 'fallen';
}

export interface BattleDeployView {
  ambush: boolean;
  approach: string;
  seed: string;
  place: string;
  enemies: BattleCreatureRow[];
}

export interface BattleTaskView {
  kind: 'dodge' | 'saw' | 'push' | 'pull' | 'sneak';
  question: string;
  options: number[];
  issuedAtMs: number;
  deadlineMs: number;
}

export interface BattleBoardView {
  scene: BattleBoardScene;
  overlay: BattleOverlayModel;
  banner: BattleBannerProps | null;
}

export interface BattleView {
  stage: 'deploy' | 'battle' | 'ended';
  outcome: 'victory' | 'defeat' | null;
  round: number;
  chips: BattleInitChip[];
  hero: BattleHeroCard | null;
  friends: BattleCreatureRow[];
  enemies: BattleCreatureRow[];
  enemiesLeft: number;
  deploy: BattleDeployView | null;
  task: BattleTaskView | null;
  board: BattleBoardView | null;
}

export function shieldSides(creature: BattleCreature, rules: BattleRules): number {
  const total =
    (creature.hands.right?.shieldCapacity ?? 0) + (creature.hands.left?.shieldCapacity ?? 0);
  return Math.min(rules.maxShieldSides, total);
}

const OPERATION_SIGN = { multiply: '×', divide: '÷' } as const;

export function taskQuestionText(question: {
  lhs: number;
  rhs: number;
  operation: keyof typeof OPERATION_SIGN;
}): string {
  return `${question.lhs} ${OPERATION_SIGN[question.operation]} ${question.rhs}`;
}

function nextLivingId(view: BattleProjection): string | null {
  for (let i = view.turnIndex + 1; i < view.order.length; i++) {
    const next = creatureById(view, view.order[i]);
    if (next && isAlive(next)) return next.id;
  }
  return null;
}

function rowTags(view: BattleProjection, creature: BattleCreature, local: boolean): BattleRowTag[] {
  if (!isAlive(creature)) return ['fallen'];
  if (view.phase === 'ended') return [];
  if (creature.id === view.activeId) return local ? ['yourTurn'] : [];
  if (creature.id === nextLivingId(view)) return ['next'];
  return view.order.indexOf(creature.id) < view.turnIndex ? ['done'] : [];
}

function creatureRow(
  creature: BattleCreature,
  input: BattleViewInput,
  targets: ReadonlySet<string>,
): BattleCreatureRow {
  const view = input.projection;
  const local = input.localHeroIds.includes(creature.id);
  return {
    id: creature.id,
    name: input.nameOf(creature.id),
    side: creature.side,
    behaviour: behaviourOf(creature.kind),
    init: view?.draws[creature.id] ?? null,
    hp: creature.hp,
    maxHp: creature.maxHp,
    shields: shieldSides(creature, input.rules),
    hits: view?.pending.filter((s) => s.targetId === creature.id).length ?? 0,
    stance: view?.stance[creature.id] ?? 0,
    tags: view ? rowTags(view, creature, local) : [],
    active: view?.activeId === creature.id && view.phase !== 'ended',
    fallen: !isAlive(creature),
    targeted: targets.has(creature.id),
  };
}

function initChips(view: BattleProjection, nameOf: NameOf): BattleInitChip[] {
  return view.order.flatMap((id, index) => {
    const creature = creatureById(view, id);
    if (!creature) return [];
    const state = !isAlive(creature)
      ? 'fallen'
      : id === view.activeId && view.phase !== 'ended'
        ? 'active'
        : index < view.turnIndex
          ? 'done'
          : 'wait';
    return [{ id, num: view.draws[id] ?? 0, name: nameOf(id), side: creature.side, state }];
  });
}

function selfHero(input: BattleViewInput): BattleCreature | null {
  const view = input.projection;
  if (!view) return null;
  const active = creatureById(view, view.activeId);
  if (active && input.localHeroIds.includes(active.id)) return active;
  const owner = view.task ? creatureById(view, view.task.creatureId) : null;
  if (owner && input.localHeroIds.includes(owner.id)) return owner;
  const local = input.localHeroIds.map((id) => creatureById(view, id)).filter(Boolean);
  return local.find((c) => isAlive(c!)) ?? local[0] ?? null;
}

function taskView(input: BattleViewInput): BattleTaskView | null {
  const task = input.projection?.task;
  if (!task || !input.localHeroIds.includes(task.creatureId)) return null;
  return {
    kind: task.kind,
    question: taskQuestionText(task.question),
    options: task.options,
    issuedAtMs: task.issuedAtMs,
    deadlineMs: task.deadlineMs,
  };
}

function defendResults(events: DomainEvent[]): DefendResultMark[] {
  const resolved = events.find((e) => e.type === 'STRIKES_RESOLVED');
  if (!resolved) return [];
  const { results } = resolved.payload as { results: DefendResultMark[] };
  return results.map((r) => ({ fromHex: r.fromHex, outcome: r.outcome }));
}

function overlayMode(input: BattleViewInput) {
  const { mode } = input.ui;
  return mode === 'swap' ? null : mode;
}

function boardView(input: BattleViewInput): BattleBoardView | null {
  const deploy = input.deploy;
  if (!deploy) return null;
  const view = input.projection;
  const controlled = controlledHero(view, input.localHeroIds);
  const overlay = battleOverlayModel(
    {
      projection: view,
      zones: view ? null : deploy.zones,
      mode: controlled ? overlayMode(input) : null,
      results: defendResults(input.lastHeroEvents),
    },
    input.rules,
  );
  const creatures = (view?.creatures ?? deploy.setup.creatures) as BattleCreature[];
  return {
    scene: {
      biome: deploy.biome,
      board: deploy.setup.board,
      boulders: view?.boulders ?? deploy.setup.boulders ?? [],
      creatures,
      activeId: view && view.phase !== 'ended' ? view.activeId : null,
    },
    overlay,
    banner: view
      ? {
          place: deploy.place,
          round: view.round,
          actor: input.nameOf(view.activeId),
          will: view.turnWill,
        }
      : null,
  };
}

function deployView(input: BattleViewInput): BattleDeployView | null {
  const deploy = input.deploy;
  if (!deploy || input.projection) return null;
  const enemies = (deploy.setup.creatures as BattleCreature[])
    .filter((c) => c.side === 'enemies')
    .map((c) => creatureRow(c, input, new Set()));
  return {
    ambush: deploy.ambush,
    approach: deploy.approach,
    seed: deploy.setup.seed,
    place: deploy.place,
    enemies,
  };
}

export function buildBattleView(input: BattleViewInput): BattleView {
  const view = input.projection;
  const board = boardView(input);
  const targets = new Set(board?.overlay.targets ?? []);
  const rows = (view?.creatures ?? []).map((c) => creatureRow(c, input, targets));
  const self = selfHero(input);
  const enemies = rows.filter((r) => r.side === 'enemies');
  return {
    stage: !view ? 'deploy' : view.phase === 'ended' ? 'ended' : 'battle',
    outcome: view?.outcome ?? null,
    round: view?.round ?? 0,
    chips: view ? initChips(view, input.nameOf) : [],
    hero: view && self ? buildHeroCard(input, view, self, rows) : null,
    friends: rows.filter((r) => r.side === 'heroes' && r.id !== self?.id),
    enemies,
    enemiesLeft: enemies.filter((r) => !r.fallen).length,
    deploy: deployView(input),
    task: taskView(input),
    board,
  };
}
