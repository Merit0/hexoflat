import type { RandomNumberGenerator } from '../../utils/random';
import type { DomainEvent } from '../types';
import type { HexEngineCommand } from '../hex-engine-commands';
import type { HexEngineActionContext, HexEngineState } from '../engine-state';

/**
 * A command handler applies one already-validated command to the state and
 * reports what happened as domain events. It never parses, never decides
 * whether the command should run at all, and never touches the applied-command
 * log — that is the dispatcher's job.
 *
 * `random` is bound to `state.rngState` by the dispatcher, so a handler that
 * rolls advances the world's own sequence and stays reproducible from the
 * snapshot. Never reach for `Math.random()` instead — see `seeded-random.ts`.
 * Handlers with nothing to roll simply omit the parameter.
 */
export type CommandHandler<TCommand extends HexEngineCommand> = (
  state: HexEngineState,
  command: TCommand,
  ctx: HexEngineActionContext,
  random: RandomNumberGenerator,
) => DomainEvent[];

/**
 * Exactly one handler per command type. This mapped type is what replaced the
 * `assertNever` default branch of the old `switch`: a command added to the
 * union without a handler here is a type error, and a handler for a type that
 * is not in the union is one too.
 */
export type CommandHandlerRegistry = {
  [K in HexEngineCommand['type']]: CommandHandler<Extract<HexEngineCommand, { type: K }>>;
};
