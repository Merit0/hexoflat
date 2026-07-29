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
import { HEX_ENGINE_COMMAND_SCHEMAS, type HexEngineCommand } from './hex-engine-commands';
import type { ApplyCommandResult, DomainEvent } from './types';

export interface HexEngineState {
  map: HexMapModel;
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
      const resolvedNow = now ?? Date.now();
      const tile = findTile(state.map, coordinates);

      if (!tile) {
        events.push({
          type: 'HEX_ACTION_START_REJECTED',
          payload: { coordinates, actionType, message: 'No tile at coordinates.' },
        });
        break;
      }

      const fullCtx: IActionContext = { ...ctx, map: state.map, now: resolvedNow };
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
      const resolvedNow = parsed.payload.now ?? Date.now();
      const fullCtx: IActionContext = { ...ctx, map: state.map, now: resolvedNow };
      const changed = new FinishPendingActionsFeature(state.map).finish(fullCtx);
      events.push({ type: 'HEX_ACTIONS_FINISHED', payload: { changed } });
      break;
    }

    case 'WORLD_TICK': {
      const resolvedNow = parsed.payload.now ?? Date.now();
      const fullCtx: IActionContext = { ...ctx, map: state.map, now: resolvedNow };
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
  }

  return { state, events };
}
