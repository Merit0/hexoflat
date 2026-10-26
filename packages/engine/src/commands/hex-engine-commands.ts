import { z } from 'zod';
import { EHexActionType } from '../enums/hex-action-type';
import { KnowledgeCommandSchema, type KnowledgeCommand } from '../knowledge/commands';
import { SACRIFICE_OPTION_IDS } from '../skills/sacrifice-rules';
import { skillIdSchema } from '../skills/skill-content';
import { LOCATION_KEYS } from '../registry/location-key';

export const hexCoordinatesSchema = z.object({
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
    heroId: z.string(),
    coordinates: hexCoordinatesSchema,
    actionType: z.enum(EHexActionType),
    toolKey: z.string(),
    now: z.number(),
  }),
});
export type StartHexActionCommand = z.infer<typeof StartHexActionCommandSchema>;

export const FinishPendingActionsCommandSchema = z.object({
  type: z.literal('FINISH_PENDING_ACTIONS'),
  payload: z.object({
    now: z.number(),
  }),
});
export type FinishPendingActionsCommand = z.infer<typeof FinishPendingActionsCommandSchema>;

export const WorldTickCommandSchema = z.object({
  type: z.literal('WORLD_TICK'),
  payload: z.object({
    now: z.number(),
  }),
});
export type WorldTickCommand = z.infer<typeof WorldTickCommandSchema>;

export const AddResourceSpawnerCommandSchema = z.object({
  type: z.literal('ADD_RESOURCE_SPAWNER'),
  payload: z.object({
    heroId: z.string(),
    coordinates: hexCoordinatesSchema,
    hexobject: hexObjectPlacementRefSchema,
  }),
});
export type AddResourceSpawnerCommand = z.infer<typeof AddResourceSpawnerCommandSchema>;

export const MoveHeroCommandSchema = z.object({
  type: z.literal('MOVE_HERO'),
  payload: z.object({
    heroId: z.string(),
    target: hexCoordinatesSchema,
  }),
});
export type MoveHeroCommand = z.infer<typeof MoveHeroCommandSchema>;

export const CrossExitCommandSchema = z.object({
  type: z.literal('CROSS_EXIT'),
  payload: z.object({
    heroId: z.string(),
    from: z.enum(LOCATION_KEYS),
  }),
});
export type CrossExitCommand = z.infer<typeof CrossExitCommandSchema>;

export const SacrificeToSkillCommandSchema = z.object({
  type: z.literal('SACRIFICE_TO_SKILL'),
  payload: z.object({
    heroId: z.string(),
    revision: z.number().int().nonnegative(),
    skillId: skillIdSchema,
    option: z.enum(SACRIFICE_OPTION_IDS),
  }),
});
export type SacrificeToSkillCommand = z.infer<typeof SacrificeToSkillCommandSchema>;

export const OpenPortalCommandSchema = z.object({
  type: z.literal('OPEN_PORTAL'),
  payload: z.object({
    heroId: z.string(),
    target: hexCoordinatesSchema,
  }),
});
export type OpenPortalCommand = z.infer<typeof OpenPortalCommandSchema>;

export const EnterPortalCommandSchema = z.object({
  type: z.literal('ENTER_PORTAL'),
  payload: z.object({
    heroId: z.string(),
  }),
});
export type EnterPortalCommand = z.infer<typeof EnterPortalCommandSchema>;

export type HexEngineCommand =
  | StartHexActionCommand
  | FinishPendingActionsCommand
  | WorldTickCommand
  | AddResourceSpawnerCommand
  | MoveHeroCommand
  | CrossExitCommand
  | KnowledgeCommand
  | SacrificeToSkillCommand
  | OpenPortalCommand
  | EnterPortalCommand;

export const HEX_ENGINE_COMMAND_SCHEMAS: Record<
  HexEngineCommand['type'],
  z.ZodType<HexEngineCommand>
> = {
  START_HEX_ACTION: StartHexActionCommandSchema,
  FINISH_PENDING_ACTIONS: FinishPendingActionsCommandSchema,
  WORLD_TICK: WorldTickCommandSchema,
  ADD_RESOURCE_SPAWNER: AddResourceSpawnerCommandSchema,
  MOVE_HERO: MoveHeroCommandSchema,
  CROSS_EXIT: CrossExitCommandSchema,
  KNOWLEDGE: KnowledgeCommandSchema,
  SACRIFICE_TO_SKILL: SacrificeToSkillCommandSchema,
  OPEN_PORTAL: OpenPortalCommandSchema,
  ENTER_PORTAL: EnterPortalCommandSchema,
};
