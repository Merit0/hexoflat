import type { CommandHandlerRegistry } from './handler-types';
import { startHexActionHandler } from './start-hex-action.handler';
import { finishPendingActionsHandler } from './finish-pending-actions.handler';
import { worldTickHandler } from './world-tick.handler';
import { addResourceSpawnerHandler } from './add-resource-spawner.handler';
import { moveHeroHandler } from './move-hero.handler';

/**
 * The command dispatch table. Adding a command means adding a schema, a union
 * member and one entry here — the mapped type makes a forgotten entry a
 * compile error rather than a silently ignored command at runtime.
 */
export const COMMAND_HANDLERS: CommandHandlerRegistry = {
  START_HEX_ACTION: startHexActionHandler,
  FINISH_PENDING_ACTIONS: finishPendingActionsHandler,
  WORLD_TICK: worldTickHandler,
  ADD_RESOURCE_SPAWNER: addResourceSpawnerHandler,
  MOVE_HERO: moveHeroHandler,
};

export type { CommandHandler, CommandHandlerRegistry } from './handler-types';
