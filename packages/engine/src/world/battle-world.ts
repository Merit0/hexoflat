import type { DomainEvent } from '../commands/types';
import type { WorldPlayerCommand } from '../aggregates/world-player-commands';
import type { ProgressState } from '../aggregates/progress-state';
import type { InventoryState } from '../inventory/inventory-state';
import { BATTLE_RULES, type BattleRules } from '../battle/battle-content';
import type { BattleAction } from '../battle/battle-commands';
import type { BattleState } from '../battle/battle-state';
import { creatureById } from '../battle/battle-board';
import { applyBattleCommand } from '../battle/apply-battle';
import { performAction } from '../battle/perform-action';
import { isRejection } from '../battle/battle-rejection';
import {
  projectBattleEvent,
  projectBattleForViewer,
  type BattleProjection,
} from '../battle/projection';
import type { SquadWorld } from '../squads/squad-actions';
import { beginBattle, closeBattle, heroBattleCreature } from '../squads/squad-battle';
import { heroModelOf, heroOf, type WorldRun } from './world-commands';
import { syncHandsToInventory } from './battle-hands-sync';
import type { ServerWorld } from './server-world';
import { diffTiles, snapshotTiles, type TileDiff } from './tile-diff';

type BattlePayload = Extract<WorldPlayerCommand, { type: 'WORLD_BATTLE' }>['payload'];

export interface BattleStep {
  events: DomainEvent[];
  battle: BattleProjection | null;
}

export type BattleWorldOutcome =
  | {
      ok: true;
      world: ServerWorld;
      progress: ProgressState;
      inventory: InventoryState;
      events: DomainEvent[];
      steps: BattleStep[];
      tileDiffs: TileDiff[];
      serverNowMs: number;
      rejected: string | null;
    }
  | { ok: false; code: string; events: DomainEvent[] };

interface Session {
  run: WorldRun;
  world: ServerWorld;
  progress: ProgressState;
  inventory: InventoryState;
  rules: BattleRules;
  steps: BattleStep[];
  events: DomainEvent[];
}

function turnKey(battle: BattleState): string {
  return `${battle.round}:${battle.turnIndex}:${battle.activeId}:${battle.phase}`;
}

function writeHealth(session: Session, battle: BattleState): void {
  const hero = creatureById(battle, session.run.heroId);
  if (hero) session.progress.health.current = hero.hp / 2;
}

function record(
  session: Session,
  before: BattleState | null,
  next: BattleState,
  raw: DomainEvent[],
) {
  if (!before || turnKey(before) !== turnKey(next)) next.turnClockMs = session.run.now;
  session.world.battle = next;
  writeHealth(session, next);
  const visible = raw.map((event) => projectBattleEvent(next, event, 'heroes'));
  session.events.push(...visible);
  session.steps.push({ events: visible, battle: projectBattleForViewer(next, 'heroes') });
}

function rejection(events: DomainEvent[]): string | null {
  const found = events.find((event) => event.type === 'BATTLE_REJECTED');
  return found ? String((found.payload as { rejected: string }).rejected) : null;
}

function settleOverdue(session: Session): void {
  const battle = session.world.battle;
  if (!battle || battle.phase === 'ended') return;
  const { now } = session.run;
  const grace = session.rules.networkGraceMs;
  const next = structuredClone(battle);
  const timeout = battle.task
    ? { creatureId: battle.task.creatureId, due: battle.task.deadlineMs, kind: 'task-timeout' }
    : battle.reaction
      ? { creatureId: battle.activeId, due: battle.reaction.deadlineMs, kind: 'reaction-timeout' }
      : null;
  if (timeout && now > timeout.due + grace) {
    const actor = creatureById(next, timeout.creatureId);
    const action = { kind: timeout.kind } as BattleAction;
    const done = actor ? performAction(next, actor, action, now, session.rules) : null;
    if (done && !isRejection(done)) record(session, battle, next, done);
  }
}

function enemyTurnDue(battle: BattleState, session: Session): boolean {
  if (battle.phase === 'ended' || battle.task || battle.reaction) return false;
  if (creatureById(battle, battle.activeId)?.side !== 'enemies') return false;
  return session.run.now >= (battle.turnClockMs ?? 0) + session.rules.enemyTurnDueMs;
}

function playOverdue(session: Session): void {
  settleOverdue(session);
  const battle = session.world.battle;
  if (!battle || !enemyTurnDue(battle, session)) return;
  const result = applyBattleCommand(
    battle,
    { type: 'BATTLE', payload: { kind: 'run-enemy-turn', atMs: session.run.now } },
    session.rules,
  );
  if (result.battle && !rejection(result.events))
    record(session, battle, result.battle, result.events);
}

function tooEarly(battle: BattleState, action: BattleAction, now: number): boolean {
  if (action.kind === 'reaction-timeout')
    return !!battle.reaction && now < battle.reaction.deadlineMs;
  if (action.kind === 'task-timeout') return !!battle.task && now < battle.task.deadlineMs;
  return false;
}

function fail(session: Session, code: string, events: DomainEvent[] = []): BattleWorldOutcome {
  if (session.steps.length === 0) return { ok: false, code, events };
  return finish(session, null, code, events);
}

function finish(
  session: Session,
  before: ReturnType<typeof snapshotTiles> | null,
  rejected: string | null,
  extra: DomainEvent[] = [],
): BattleWorldOutcome {
  const { world } = session;
  return {
    ok: true,
    world,
    progress: session.progress,
    inventory: session.inventory,
    events: [...session.events, ...extra],
    steps: session.steps,
    tileDiffs: before ? diffTiles(before, world.map) : [],
    serverNowMs: session.run.now,
    rejected,
  };
}

function squadWorldOf(session: Session): SquadWorld | null {
  const hero = heroOf({ ...session.run, world: session.world, progress: session.progress });
  if (!hero) return null;
  return {
    map: session.world.map,
    heroes: { [session.run.heroId]: hero },
    knowledge: session.progress.knowledge,
    battle: session.world.battle ?? undefined,
    engagement: session.world.engagement ?? undefined,
    inventory: session.inventory,
  };
}

function startBattleWorld(session: Session): BattleWorldOutcome {
  if (session.world.battle) return fail(session, 'BATTLE_OPEN');
  if (!session.world.engagement) return fail(session, 'NO_ENGAGEMENT');
  const squadWorld = squadWorldOf(session);
  if (!squadWorld) return fail(session, 'NO_POSITION');
  const model = heroModelOf(session.progress);
  const hero = heroBattleCreature({
    id: session.run.heroId,
    hearts: model.currentHealth,
    maxHearts: model.maxHealth + model.maxHealthBonus,
    weapon: null,
    shield: null,
    bag: [],
  });
  const outcome = beginBattle(squadWorld, [hero]);
  if (!outcome.ok) return fail(session, outcome.reason);
  const battle = squadWorld.battle!;
  session.world.engagement = squadWorld.engagement ?? null;
  record(session, null, battle, outcome.events);
  return finish(session, null, null);
}

function closeBattleWorld(session: Session): BattleWorldOutcome {
  const squadWorld = squadWorldOf(session);
  if (!squadWorld) return fail(session, 'NO_POSITION');
  const before = snapshotTiles(session.world.map);
  const outcome = closeBattle(squadWorld);
  if (!outcome.ok) return fail(session, outcome.reason);
  session.world.battle = null;
  session.world.engagement = null;
  session.inventory = squadWorld.inventory ?? session.inventory;
  const closed = outcome.events.find((event) => event.type === 'BATTLE_CLOSED');
  const kills = Number((closed?.payload as { kills?: number } | undefined)?.kills ?? 0);
  session.progress.kills += kills;
  session.events.push(...outcome.events);
  session.steps.push({ events: outcome.events, battle: null });
  return finish(session, before, null);
}

function fightBattleWorld(session: Session, payload: BattlePayload): BattleWorldOutcome {
  const battle = session.world.battle;
  if (!battle) return fail(session, 'NO_BATTLE');
  const { now } = session.run;
  const fight =
    payload.kind === 'hero'
      ? ({
          kind: 'hero',
          heroId: session.run.heroId,
          atMs: now,
          action: payload.action,
        } as const)
      : ({ kind: 'run-enemy-turn', atMs: now } as const);
  if (payload.kind === 'hero' && tooEarly(battle, payload.action, now)) {
    return fail(session, 'TOO_EARLY');
  }
  const result = applyBattleCommand(battle, { type: 'BATTLE', payload: fight }, session.rules);
  const refused = rejection(result.events);
  if (refused || !result.battle) return fail(session, refused ?? 'NO_BATTLE', result.events);
  if (payload.kind === 'hero' && payload.action.kind === 'set-hands') {
    const before = creatureById(battle, session.run.heroId);
    const after = creatureById(result.battle, session.run.heroId);
    const synced = before && after ? syncHandsToInventory(session.inventory, before, after) : null;
    if (!synced) return fail(session, 'HANDS_MISMATCH');
    session.inventory = synced;
  }
  record(session, battle, result.battle, result.events);
  return finish(session, null, null);
}

export function battleWorld(
  run: WorldRun,
  payload: BattlePayload,
  rules: BattleRules = BATTLE_RULES,
): BattleWorldOutcome {
  const world: ServerWorld = {
    ...run.world,
    battle: run.world.battle ? structuredClone(run.world.battle) : null,
    engagement: run.world.engagement ? structuredClone(run.world.engagement) : null,
  };
  const session: Session = {
    run,
    world,
    progress: structuredClone(run.progress),
    inventory: structuredClone(run.inventory),
    rules,
    steps: [],
    events: [],
  };
  if (payload.kind === 'start') return startBattleWorld(session);
  playOverdue(session);
  if (payload.kind === 'sync') {
    return session.steps.length > 0
      ? finish(session, null, null)
      : fail(session, 'NOTHING_TO_SETTLE');
  }
  if (payload.kind === 'close') return closeBattleWorld(session);
  return fightBattleWorld(session, payload);
}
