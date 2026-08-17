import { HEX_ENGINE_COMMAND_SCHEMAS, type HexEngineCommand } from './hex-engine-commands';
import { COMMAND_HANDLERS, type CommandHandler } from './handlers';
import { findAppliedCommand, recordAppliedCommand } from './applied-command-log';
import type { ApplyCommandResult, DomainEvent } from './types';
import { createSeededRandom } from '../utils/seeded-random';
import type { HexEngineActionContext, HexEngineState } from './engine-state';

export { createEngineState } from './engine-state';
export type { CreateEngineStateInit, HexEngineActionContext, HexEngineState } from './engine-state';

/**
 * Emitted when a command carried an `expectedStateVersion` that no longer
 * matches. A rules-level refusal, not a crash: the caller decides whether to
 * re-read the world and try again.
 */
export interface CommandRejectedEvent extends DomainEvent {
  type: 'COMMAND_REJECTED';
  payload: {
    commandId: string;
    commandType: HexEngineCommand['type'];
    reason: 'STALE_STATE_VERSION';
    expectedStateVersion: number;
    actualStateVersion: number;
  };
}

/**
 * The single legal entry point for changing game state.
 *
 * The order matters and is the whole contract:
 *
 * 1. Validate against the command's Zod schema.
 * 2. If this `commandId` already ran, return what it returned the first time
 *    and touch nothing — a retry after a dropped socket must not gather the
 *    resource twice, and must not advance the RNG a second time either.
 * 3. If the caller pinned an `expectedStateVersion` and the world has moved
 *    on, refuse with an event.
 * 4. Otherwise run the handler, bump the version, and remember the outcome.
 *
 * Dispatch is a registry lookup rather than a `switch` because the exploration
 * slice adds enough commands that one function would blow the complexity
 * ratchet — and because "which handler runs" then becomes data.
 *
 * Validation deliberately throws instead of emitting an event: a malformed
 * command is a programming error on the caller's side, not a move the game
 * refused. Rules-level refusals come back as events.
 */
export function applyCommand(
  state: HexEngineState,
  command: HexEngineCommand,
  ctx: HexEngineActionContext,
): ApplyCommandResult<HexEngineState> {
  const schema = HEX_ENGINE_COMMAND_SCHEMAS[command.type];
  const parsed = schema.parse(command);

  const alreadyApplied = findAppliedCommand(state.appliedCommands, parsed.commandId);
  if (alreadyApplied) {
    return { state, events: alreadyApplied.events, replayed: true };
  }

  const staleVersion = rejectIfStale(state, parsed);
  if (staleVersion) {
    return { state, events: [staleVersion], replayed: false };
  }

  // TypeScript cannot narrow a mapped-type lookup by a union key, so the
  // registry's per-command typing (enforced at the definition site in
  // handlers/index.ts) is widened here rather than re-proved.
  const handler = COMMAND_HANDLERS[parsed.type] as CommandHandler<HexEngineCommand>;
  const random = createSeededRandom(state.rngState);

  const events = handler(state, parsed, ctx, random);

  state.stateVersion += 1;
  recordAppliedCommand(state.appliedCommands, {
    commandId: parsed.commandId,
    stateVersion: state.stateVersion,
    events,
  });

  return { state, events, replayed: false };
}

function rejectIfStale(
  state: HexEngineState,
  command: HexEngineCommand,
): CommandRejectedEvent | null {
  const { expectedStateVersion } = command;
  if (expectedStateVersion === undefined || expectedStateVersion === state.stateVersion) {
    return null;
  }

  return {
    type: 'COMMAND_REJECTED',
    payload: {
      commandId: command.commandId,
      commandType: command.type,
      reason: 'STALE_STATE_VERSION',
      expectedStateVersion,
      actualStateVersion: state.stateVersion,
    },
  };
}
