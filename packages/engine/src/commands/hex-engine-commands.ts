import { z } from 'zod';
import { EHexActionType } from '../enums/hex-action-type';

const hexCoordinatesSchema = z.object({
  columnIndex: z.number(),
  rowIndex: z.number(),
});

const hexObjectPlacementRefSchema = z.object({
  hexobjectKey: z.string(),
  overrides: z.record(z.string(), z.any()).optional(),
});

export const StartHexActionCommandSchema = z.object({
  type: z.literal('START_HEX_ACTION'),
  payload: z.object({
    coordinates: hexCoordinatesSchema,
    actionType: z.nativeEnum(EHexActionType),
    toolKey: z.string(),
    now: z.number().optional(),
  }),
});
export type StartHexActionCommand = z.infer<typeof StartHexActionCommandSchema>;

export const FinishPendingActionsCommandSchema = z.object({
  type: z.literal('FINISH_PENDING_ACTIONS'),
  payload: z.object({
    now: z.number().optional(),
  }),
});
export type FinishPendingActionsCommand = z.infer<typeof FinishPendingActionsCommandSchema>;

export const WorldTickCommandSchema = z.object({
  type: z.literal('WORLD_TICK'),
  payload: z.object({
    now: z.number().optional(),
  }),
});
export type WorldTickCommand = z.infer<typeof WorldTickCommandSchema>;

export const AddResourceSpawnerCommandSchema = z.object({
  type: z.literal('ADD_RESOURCE_SPAWNER'),
  payload: z.object({
    coordinates: hexCoordinatesSchema,
    hexobject: hexObjectPlacementRefSchema,
  }),
});
export type AddResourceSpawnerCommand = z.infer<typeof AddResourceSpawnerCommandSchema>;

export type HexEngineCommand =
  | StartHexActionCommand
  | FinishPendingActionsCommand
  | WorldTickCommand
  | AddResourceSpawnerCommand;

export const HEX_ENGINE_COMMAND_SCHEMAS: Record<
  HexEngineCommand['type'],
  z.ZodType<HexEngineCommand>
> = {
  START_HEX_ACTION: StartHexActionCommandSchema,
  FINISH_PENDING_ACTIONS: FinishPendingActionsCommandSchema,
  WORLD_TICK: WorldTickCommandSchema,
  ADD_RESOURCE_SPAWNER: AddResourceSpawnerCommandSchema,
};
