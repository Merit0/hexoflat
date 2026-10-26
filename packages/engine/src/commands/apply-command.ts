import { isEnterableTile } from '../hero-movement/move-planner';
import { coordinateKey, hexDistance } from '../utils/hex-utils';
import { applyKnowledgeCommand } from '../knowledge/reducer';
import { applyResetSkills } from '../skills/reset-skills';
import { applySacrificeToSkill } from '../skills/sacrifice-skill';
import type { KnowledgeState } from '../knowledge/state';
import type { KnowledgeCommand, KnowledgeContext } from '../knowledge/commands';
import { willZoneCharges } from '../knowledge/will-zone';
import { actionWillCost, spendWill, willRejected } from '../knowledge/will';
import { EHexActionType } from '../enums/hex-action-type';
import HexMapModel from '../map/models/hex-map-model';
import type { HexTileModel } from '../map/models/hex-tile-model';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { ExecuteHexActionFeature } from '../features/execute-hex-action-feature';
import { FinishPendingActionsFeature } from '../features/resource-features/finish-pending-actions-feature';
import { WorldTickFeature } from '../features/resource-features/world-tick-feature';
import { AddResourceSpawnerFeature } from '../features/resource-features/add-resource-spawner-feature';
import type { IActionContext } from '../abstraction/abstract-action';
import type { HexObjectPlacementRef } from '../abstraction/hex-map-placement';
import type { THeroToolKey } from '../content/equipment.content';
import type { HeroState } from '../hero-movement/hero-state';
import { getReachableTileDistances } from '../hero-movement/reachable-range-service';
import { findShortestPath } from '../hero-movement/pathfinding-service';
import { getScoutMoveStepsForSteps } from '../hero-movement/scout-progression';
import type { RngState } from '../utils/random-seeded';
import { assertNever } from '../utils/assert-never';
import { planBoardCrossing } from '../hero-movement/board-crossing';
import {
  HEX_ENGINE_COMMAND_SCHEMAS,
  type HexEngineCommand,
  type CrossExitCommand,
  type StartHexActionCommand,
  type MoveHeroCommand,
  type ResetSkillsCommand,
  type SacrificeToSkillCommand,
} from './hex-engine-commands';
import { applyEnterPortal, applyOpenPortal, closePortalIfOpen } from '../portal/apply-portal';
import type { PortalLocation } from '../portal/portal-rules';
import { getMeta } from '../content/content-accessors';
import type { ApplyCommandResult, DomainEvent } from './types';

export interface HexEngineState {
  map: HexMapModel;
  heroes: Record<string, HeroState>;
  rngState?: RngState;
  knowledge?: KnowledgeState;
  knowledgeContext?: KnowledgeContext;
  location?: PortalLocation;
}

/** Everything applyCommand needs beyond map/now — built by the caller from its own stores/ports. */
export type HexEngineActionContext = Omit<IActionContext, 'map' | 'now'>;

function findTile(map: HexMapModel, coordinates: IHexCoordinates): HexTileModel | null {
  return (
    map.tiles.find(
      (t) =>
        t.coordinates.columnIndex === coordinates.columnIndex &&
        t.coordinates.rowIndex === coordinates.rowIndex,
    ) ?? null
  );
}

export function applyCommand(
  state: HexEngineState,
  command: HexEngineCommand,
  ctx: HexEngineActionContext,
): ApplyCommandResult<HexEngineState> {
  const schema = HEX_ENGINE_COMMAND_SCHEMAS[command.type];
  const parsed = schema.parse(command);
  const events: DomainEvent[] = [];

  switch (parsed.type) {
    case 'KNOWLEDGE':
      events.push(...applyKnowledgeState(state, parsed));
      break;
    case 'RESET_SKILLS':
      events.push(...applyResetState(state, parsed));
      break;
    case 'SACRIFICE_TO_SKILL':
      events.push(...applySacrificeState(state, parsed));
      break;
    case 'START_HEX_ACTION':
      events.push(...applyStartHexAction(state, parsed, ctx));
      break;

    case 'FINISH_PENDING_ACTIONS': {
      const fullCtx: IActionContext = { ...ctx, map: state.map, now: parsed.payload.now };
      const changed = new FinishPendingActionsFeature(state.map).finish(fullCtx);
      events.push({ type: 'HEX_ACTIONS_FINISHED', payload: { changed } });
      break;
    }

    case 'WORLD_TICK': {
      const fullCtx: IActionContext = { ...ctx, map: state.map, now: parsed.payload.now };
      const changed = new WorldTickFeature(state.map).tick(fullCtx);
      events.push({ type: 'WORLD_TICKED', payload: { changed } });
      break;
    }

    case 'ADD_RESOURCE_SPAWNER': {
      const { coordinates, hexobject } = parsed.payload;
      const tile = findTile(state.map, coordinates);

      if (!tile) {
        events.push({
          type: 'RESOURCE_SPAWNER_REJECTED',
          payload: { coordinates, message: 'No tile at coordinates.' },
        });
        break;
      }

      new AddResourceSpawnerFeature(tile, hexobject as HexObjectPlacementRef).add();
      events.push({ type: 'RESOURCE_SPAWNER_ADDED', payload: { coordinates } });
      break;
    }

    case 'MOVE_HERO':
      applyMoveHero(state, parsed.payload, events);
      break;

    case 'CROSS_EXIT': {
      const crossed = applyCrossExit(state, parsed.payload, ctx);
      events.push(crossed);
      if (crossed.type === 'BOARD_EXITED') {
        events.push(...closePortalIfOpen(state, parsed.payload.heroId, { kind: 'GATE' }));
      }
      break;
    }

    case 'OPEN_PORTAL':
      events.push(...applyOpenPortal(state, parsed.payload, ctx));
      break;

    case 'ENTER_PORTAL':
      events.push(...applyEnterPortal(state, parsed.payload, ctx));
      break;

    default:
      return assertNever(parsed);
  }

  return { state, events };
}

function isWorldGate(tile: HexTileModel, actionType: EHexActionType): boolean {
  const key = tile.hexobject?.hexobjectKey;
  return actionType === EHexActionType.ENTER && !!key && getMeta(key).enter?.type === 'WORLD';
}

function applyStartHexAction(
  state: HexEngineState,
  parsed: StartHexActionCommand,
  ctx: HexEngineActionContext,
): DomainEvent[] {
  const out: DomainEvent[] = [];
  const { coordinates, actionType, toolKey, now } = parsed.payload;
  const tile = findTile(state.map, coordinates);

  if (!tile) {
    out.push({
      type: 'HEX_ACTION_START_REJECTED',
      payload: { coordinates, actionType, message: 'No tile at coordinates.' },
    });
    return out;
  }

  const cost = actionCharge(state, tile, actionType);
  if (cost > 0) {
    const { knowledge } = state;
    const ref = `${actionType}:${coordinateKey(coordinates)}`;
    if (!knowledge || knowledge.heroId !== parsed.payload.heroId) {
      out.push(
        willRejected(parsed.payload.heroId, 'NO_WILL_STATE', ref),
        rejectedStart(coordinates, actionType, 'Will is unavailable.'),
      );
      return out;
    }
    if (knowledge.current < cost) {
      out.push(
        willRejected(knowledge.heroId, 'INSUFFICIENT_WILL', ref),
        rejectedStart(coordinates, actionType, 'Not enough Will.'),
      );
      return out;
    }
  }

  const fullCtx: IActionContext = { ...ctx, map: state.map, now };
  const result = new ExecuteHexActionFeature(tile).execute(
    actionType,
    toolKey as THeroToolKey,
    fullCtx,
  );

  if (result.ok && cost > 0) {
    const knowledge = state.knowledge!;
    const reason = actionType === EHexActionType.ENTER ? 'entry' : 'action';
    const spent = spendWill(knowledge, cost, reason, `${actionType}:${coordinateKey(coordinates)}`);
    knowledge.revision++;
    out.push(...spent.events);
  }

  if (result.ok && isWorldGate(tile, actionType)) {
    out.push(...closePortalIfOpen(state, parsed.payload.heroId, { kind: 'GATE' }));
  }

  out.push(
    result.ok
      ? {
          type: 'HEX_ACTION_STARTED',
          payload: { coordinates, actionType, endsAt: result.endsAt },
        }
      : {
          type: 'HEX_ACTION_START_REJECTED',
          payload: { coordinates, actionType, message: result.message },
        },
  );
  return out;
}

function rejectedStart(
  coordinates: IHexCoordinates,
  actionType: EHexActionType,
  message: string,
): DomainEvent {
  return { type: 'HEX_ACTION_START_REJECTED', payload: { coordinates, actionType, message } };
}

function actionCharge(state: HexEngineState, tile: HexTileModel, actionType: EHexActionType) {
  const cost = actionWillCost(tile, actionType);
  if (cost <= 0) return 0;
  if (!state.knowledgeContext) return 0;
  return willZoneCharges(state.knowledgeContext) ? cost : 0;
}

function applyResetState(state: HexEngineState, command: ResetSkillsCommand): DomainEvent[] {
  if (!state.knowledge || !state.knowledgeContext) {
    return [{ type: 'SKILL_REJECTED', payload: { reason: 'Missing authoritative context' } }];
  }
  return applyResetSkills(state.knowledge, state.knowledgeContext, command.payload);
}

function applySacrificeState(
  state: HexEngineState,
  command: SacrificeToSkillCommand,
): DomainEvent[] {
  if (!state.knowledge || !state.knowledgeContext) {
    return [{ type: 'SKILL_REJECTED', payload: { reason: 'Missing authoritative context' } }];
  }
  return applySacrificeToSkill(state.knowledge, state.knowledgeContext, command.payload);
}

function applyKnowledgeState(state: HexEngineState, command: KnowledgeCommand): DomainEvent[] {
  if (!state.knowledge || !state.knowledgeContext) {
    return [{ type: 'KNOWLEDGE_REJECTED', payload: { reason: 'Missing authoritative context' } }];
  }
  const { action } = command.payload;
  if (action.kind === 'step') {
    const origin = state.knowledgeContext.coordinates;
    if (
      !origin ||
      !action.target ||
      hexDistance(origin, action.target) !== 1 ||
      !isEnterableTile(state.map, action.target)
    ) {
      return [{ type: 'KNOWLEDGE_REJECTED', payload: { reason: 'Invalid movement step' } }];
    }
  }
  return applyKnowledgeCommand(state.knowledge, command, state.knowledgeContext);
}

function applyMoveHero(
  state: HexEngineState,
  payload: MoveHeroCommand['payload'],
  events: DomainEvent[],
): void {
  const { heroId, target } = payload;
  const hero = state.heroes[heroId];

  if (!hero) {
    events.push({
      type: 'HERO_MOVE_REJECTED',
      payload: { heroId, target, reason: 'HERO_NOT_FOUND' },
    });
    return;
  }

  const targetKey = coordinateKey(target);
  const isOccupiedByOtherHero = Object.values(state.heroes).some(
    (other) => other.id !== heroId && coordinateKey(other.coordinates) === targetKey,
  );

  if (isOccupiedByOtherHero) {
    events.push({
      type: 'HERO_MOVE_REJECTED',
      payload: { heroId, target, reason: 'TILE_OCCUPIED' },
    });
    return;
  }

  const moveSteps = getScoutMoveStepsForSteps(hero.heroSteps);
  const reachable = getReachableTileDistances(state.map, hero.coordinates, moveSteps);

  if (!reachable.has(targetKey)) {
    events.push({
      type: 'HERO_MOVE_REJECTED',
      payload: { heroId, target, reason: 'UNREACHABLE' },
    });
    return;
  }

  const path = findShortestPath(state.map, hero.coordinates, target, moveSteps);

  if (!path || path.length < 2) {
    events.push({
      type: 'HERO_MOVE_REJECTED',
      payload: { heroId, target, reason: 'NO_PATH' },
    });
    return;
  }

  const stepsTaken = path.length - 1;
  // Deliberate in-place mutation, not a copy-on-write update: applyCommand
  // has exactly one writer per HexEngineState (the single-threaded
  // server/client loop that owns `state`), so there's no concurrent
  // reader to see a torn intermediate value. Don't "fix" this into
  // rebuilding `state.heroes` — that would just be extra allocation for
  // the same guarantee this already has.
  hero.coordinates = { ...target };
  hero.heroSteps += stepsTaken;

  events.push({
    type: 'HERO_MOVED',
    payload: { heroId, path, heroSteps: hero.heroSteps },
  });
}

function applyCrossExit(
  state: HexEngineState,
  payload: CrossExitCommand['payload'],
  ctx: HexEngineActionContext,
): DomainEvent {
  const { heroId, from } = payload;
  const hero = state.heroes[heroId];
  if (!hero) return { type: 'BOARD_EXIT_REJECTED', payload: { heroId, reason: 'HERO_NOT_FOUND' } };

  const plan = planBoardCrossing(state.map, hero.coordinates, from, {
    combatActive: ctx.worldMap.combatActive,
    isLocationSealed: (locationKey) => ctx.worldMap.isLocationRespawning(locationKey),
  });
  if (!plan.ok) return { type: 'BOARD_EXIT_REJECTED', payload: { heroId, reason: plan.reason } };

  if (plan.crossing.restingSpot) hero.coordinates = { ...plan.crossing.restingSpot };
  return { type: 'BOARD_EXITED', payload: { heroId, ...plan.crossing } };
}
