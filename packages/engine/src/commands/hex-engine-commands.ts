import { z } from 'zod';
import { EHexActionType } from '../enums/hex-action-type';

export const hexCoordinatesSchema = z.object({
  columnIndex: z.number(),
  rowIndex: z.number(),
});

const hexObjectPlacementRefSchema = z.object({
  hexobjectKey: z.string(),
  overrides: z.record(z.string(), z.any()).optional(),
});

/**
 * The envelope every command carries, independent of what it does.
 *
 * `commandId` makes a command safely retryable: a client that resends after a
 * dropped socket, or a co-op peer that replays, must not gather the resource
 * twice. `expectedStateVersion` is optimistic concurrency — a peer that acted
 * on a stale view of the world gets told so instead of silently overwriting
 * someone else's move. `actorId` is *who asked*, which is not the same as the
 * `heroId` a payload may carry: in drop-in/drop-out co-op one user can be
 * driving a hero they do not own.
 *
 * The slice is single-player (workflow doc §3.6), so none of this is load
 * bearing yet — it is here now because retrofitting identity onto seventeen
 * commands later is how it ends up never happening.
 */
const commandEnvelopeShape = {
  /** Unique per intent, not per attempt — retries reuse it, that is the point. */
  commandId: z.string().min(1),
  actorId: z.string().min(1),
  /** Omit when the caller does not care whether the world moved under it. */
  expectedStateVersion: z.number().int().nonnegative().optional(),
};

export const StartHexActionCommandSchema = z.object({
  ...commandEnvelopeShape,
  type: z.literal('START_HEX_ACTION'),
  payload: z.object({
    heroId: z.string(),
    coordinates: hexCoordinatesSchema,
    actionType: z.nativeEnum(EHexActionType),
    toolKey: z.string(),
    now: z.number(),
  }),
});
export type StartHexActionCommand = z.infer<typeof StartHexActionCommandSchema>;

export const FinishPendingActionsCommandSchema = z.object({
  ...commandEnvelopeShape,
  type: z.literal('FINISH_PENDING_ACTIONS'),
  payload: z.object({
    now: z.number(),
  }),
});
export type FinishPendingActionsCommand = z.infer<typeof FinishPendingActionsCommandSchema>;

export const WorldTickCommandSchema = z.object({
  ...commandEnvelopeShape,
  type: z.literal('WORLD_TICK'),
  payload: z.object({
    now: z.number(),
  }),
});
export type WorldTickCommand = z.infer<typeof WorldTickCommandSchema>;

export const AddResourceSpawnerCommandSchema = z.object({
  ...commandEnvelopeShape,
  type: z.literal('ADD_RESOURCE_SPAWNER'),
  payload: z.object({
    heroId: z.string(),
    coordinates: hexCoordinatesSchema,
    hexobject: hexObjectPlacementRefSchema,
  }),
});
export type AddResourceSpawnerCommand = z.infer<typeof AddResourceSpawnerCommandSchema>;

export const MoveHeroCommandSchema = z.object({
  ...commandEnvelopeShape,
  type: z.literal('MOVE_HERO'),
  payload: z.object({
    heroId: z.string(),
    target: hexCoordinatesSchema,
  }),
});
export type MoveHeroCommand = z.infer<typeof MoveHeroCommandSchema>;

/** The envelope alone, for code that routes commands without knowing their payloads. */
export type CommandEnvelope = z.infer<z.ZodObject<typeof commandEnvelopeShape>>;

export type HexEngineCommand =
  | StartHexActionCommand
  | FinishPendingActionsCommand
  | WorldTickCommand
  | AddResourceSpawnerCommand
  | MoveHeroCommand;

export const HEX_ENGINE_COMMAND_SCHEMAS: Record<
  HexEngineCommand['type'],
  z.ZodType<HexEngineCommand>
> = {
  START_HEX_ACTION: StartHexActionCommandSchema,
  FINISH_PENDING_ACTIONS: FinishPendingActionsCommandSchema,
  WORLD_TICK: WorldTickCommandSchema,
  ADD_RESOURCE_SPAWNER: AddResourceSpawnerCommandSchema,
  MOVE_HERO: MoveHeroCommandSchema,
};
