import type { IActionContext } from '../../abstraction/abstract-action';
import { WorldTickFeature } from '../../features/resource-features/world-tick-feature';
import type { WorldTickCommand } from '../hex-engine-commands';
import type { CommandHandler } from './handler-types';

export const worldTickHandler: CommandHandler<WorldTickCommand> = (state, command, ctx) => {
  const fullCtx: IActionContext = { ...ctx, map: state.map, now: command.payload.now };
  const changed = new WorldTickFeature(state.map).tick(fullCtx);

  return [{ type: 'WORLD_TICKED', payload: { changed } }];
};
