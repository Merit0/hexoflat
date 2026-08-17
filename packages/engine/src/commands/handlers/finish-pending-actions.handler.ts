import type { IActionContext } from '../../abstraction/abstract-action';
import { FinishPendingActionsFeature } from '../../features/resource-features/finish-pending-actions-feature';
import type { FinishPendingActionsCommand } from '../hex-engine-commands';
import type { CommandHandler } from './handler-types';

export const finishPendingActionsHandler: CommandHandler<FinishPendingActionsCommand> = (
  state,
  command,
  ctx,
) => {
  const fullCtx: IActionContext = { ...ctx, map: state.map, now: command.payload.now };
  const changed = new FinishPendingActionsFeature(state.map).finish(fullCtx);

  return [{ type: 'HEX_ACTIONS_FINISHED', payload: { changed } }];
};
