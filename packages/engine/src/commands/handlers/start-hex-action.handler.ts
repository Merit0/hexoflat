import type { IActionContext } from '../../abstraction/abstract-action';
import type { THeroToolKey } from '../../content/equipment.content';
import { ExecuteHexActionFeature } from '../../features/execute-hex-action-feature';
import type { StartHexActionCommand } from '../hex-engine-commands';
import type { CommandHandler } from './handler-types';

export const startHexActionHandler: CommandHandler<StartHexActionCommand> = (
  state,
  command,
  ctx,
) => {
  const { coordinates, actionType, toolKey, now } = command.payload;
  const tile = state.map.getTileAt(coordinates);

  if (!tile) {
    return [
      {
        type: 'HEX_ACTION_START_REJECTED',
        payload: { coordinates, actionType, message: 'No tile at coordinates.' },
      },
    ];
  }

  const fullCtx: IActionContext = { ...ctx, map: state.map, now };
  const result = new ExecuteHexActionFeature(tile).execute(
    actionType,
    toolKey as THeroToolKey,
    fullCtx,
  );

  return [
    result.ok
      ? {
          type: 'HEX_ACTION_STARTED',
          payload: { coordinates, actionType, endsAt: result.endsAt },
        }
      : {
          type: 'HEX_ACTION_START_REJECTED',
          payload: { coordinates, actionType, message: result.message },
        },
  ];
};
