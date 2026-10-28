import { z } from 'zod';

export const axialSchema = z.object({ q: z.number().int(), r: z.number().int() });
export type BattleHex = z.infer<typeof axialSchema>;

export const BATTLE_TERRAINS = ['floor', 'wall', 'rubble', 'ledge'] as const;
export const battleTerrainSchema = z.enum(BATTLE_TERRAINS);
export type BattleTerrain = z.infer<typeof battleTerrainSchema>;

export const BATTLE_SIDES = ['heroes', 'enemies'] as const;
export const battleSideSchema = z.enum(BATTLE_SIDES);
export type BattleSide = z.infer<typeof battleSideSchema>;

export const BATTLE_HANDS = ['right', 'left'] as const;
export const battleHandSchema = z.enum(BATTLE_HANDS);
export type BattleHand = z.infer<typeof battleHandSchema>;

export const battleItemSchema = z.object({
  key: z.string().min(1),
  power: z.number().int().min(0).optional(),
  shieldCapacity: z.number().int().min(0).optional(),
});
export type BattleItem = z.infer<typeof battleItemSchema>;

export const battleCreatureSchema = z.object({
  id: z.string().min(1),
  side: battleSideSchema,
  kind: z.string().min(1),
  pos: axialSchema,
  hp: z.number().int().min(0),
  maxHp: z.number().int().positive(),
  weight: z.number().int().min(0),
  force: z.number().int().min(0),
  hands: z.object({ right: battleItemSchema.nullable(), left: battleItemSchema.nullable() }),
});
export type BattleCreature = z.infer<typeof battleCreatureSchema>;

export const pendingStrikeSchema = z.object({
  id: z.string().min(1),
  attackerId: z.string().min(1),
  targetId: z.string().min(1),
  fromHex: axialSchema,
  ring: z.array(axialSchema),
  power: z.number().int().min(0),
});
export type PendingStrike = z.infer<typeof pendingStrikeSchema>;

export const undoStepSchema = z.object({
  from: axialSchema,
  to: axialSchema,
  cost: z.number().int().min(0),
});
export type UndoStep = z.infer<typeof undoStepSchema>;

export const BATTLE_PHASES = ['defend', 'act', 'ended'] as const;
export const battlePhaseSchema = z.enum(BATTLE_PHASES);
export type BattlePhase = z.infer<typeof battlePhaseSchema>;

export const battleOutcomeSchema = z.enum(['victory', 'defeat']);
export type BattleOutcome = z.infer<typeof battleOutcomeSchema>;

export const battleStateSchema = z.object({
  id: z.string().min(1),
  seed: z.string().min(1),
  board: z.record(z.string(), battleTerrainSchema),
  creatures: z.array(battleCreatureSchema).min(2),
  round: z.number().int().min(0),
  draws: z.record(z.string(), z.number().int().positive()),
  order: z.array(z.string()),
  turnIndex: z.number().int().min(0),
  activeId: z.string(),
  phase: battlePhaseSchema,
  turnWill: z.number().int().min(0),
  stance: z.record(z.string(), z.number().int().min(0)),
  struckHands: z.array(battleHandSchema),
  placedShields: z.array(axialSchema),
  pending: z.array(pendingStrikeSchema),
  undo: z.array(undoStepSchema),
  strikeSeq: z.number().int().min(0),
  outcome: battleOutcomeSchema.optional(),
});
export type BattleState = z.infer<typeof battleStateSchema>;

export const battleSetupSchema = z.object({
  id: z.string().min(1),
  seed: z.string().min(1),
  board: z.record(z.string(), battleTerrainSchema),
  creatures: z.array(battleCreatureSchema).min(2),
});
export type BattleSetup = z.infer<typeof battleSetupSchema>;
