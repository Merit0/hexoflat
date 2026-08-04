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
import { coordinateKey } from '../utils/hex-utils';
import { assertNever } from '../utils/assert-never';
import { HEX_ENGINE_COMMAND_SCHEMAS, type HexEngineCommand } from './hex-engine-commands';
import type { ApplyCommandResult, DomainEvent } from './types';

export interface HexEngineState {
  map: HexMapModel;
  heroes: Record<string, HeroState>;
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
    case 'START_HEX_ACTION': {
      const { coordinates, actionType, toolKey, now } = parsed.payload;
      const tile = findTile(state.map, coordinates);

      if (!tile) {
        events.push({
          type: 'HEX_ACTION_START_REJECTED',
          payload: { coordinates, actionType, message: 'No tile at coordinates.' },
        });
        break;
      }

      const fullCtx: IActionContext = { ...ctx, map: state.map, now };
      const result = new ExecuteHexActionFeature(tile).execute(
        actionType,
        toolKey as THeroToolKey,
        fullCtx,
      );

      events.push(
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
      break;
    }

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

    case 'MOVE_HERO': {
      const { heroId, target } = parsed.payload;
      const hero = state.heroes[heroId];

      if (!hero) {
        events.push({
          type: 'HERO_MOVE_REJECTED',
          payload: { heroId, target, reason: 'HERO_NOT_FOUND' },
        });
        break;
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
        break;
      }

      const moveSteps = getScoutMoveStepsForSteps(hero.heroSteps);
      const reachable = getReachableTileDistances(state.map, hero.coordinates, moveSteps);

      if (!reachable.has(targetKey)) {
        events.push({
          type: 'HERO_MOVE_REJECTED',
          payload: { heroId, target, reason: 'UNREACHABLE' },
        });
        break;
      }

      const path = findShortestPath(state.map, hero.coordinates, target, moveSteps);

      if (!path || path.length < 2) {
        events.push({
          type: 'HERO_MOVE_REJECTED',
          payload: { heroId, target, reason: 'NO_PATH' },
        });
        break;
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
      break;
    }

    default:
      return assertNever(parsed);
  }

  return { state, events };
}
