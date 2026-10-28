import { z } from 'zod';

export const axialSchema = z.object({ q: z.number().int(), r: z.number().int() });
export type BattleHex = z.infer<typeof axialSchema>;

export const BATTLE_TERRAINS = ['floor', 'wall', 'rubble', 'ledge', 'oil', 'saw'] as const;
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
  heal: z.number().int().positive().optional(),
  range: z.object({ min: z.number().int().min(1), max: z.number().int().min(1) }).optional(),
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
  bag: z.array(battleItemSchema).default([]),
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

export const boulderSchema = z.object({ id: z.string().min(1), pos: axialSchema });
export type Boulder = z.infer<typeof boulderSchema>;

export const TASK_KINDS = ['dodge', 'saw', 'push', 'pull'] as const;
export const taskKindSchema = z.enum(TASK_KINDS);
export type TaskKind = z.infer<typeof taskKindSchema>;

export const battleTaskSchema = z.object({
  id: z.string().min(1),
  kind: taskKindSchema,
  creatureId: z.string().min(1),
  question: z.object({
    operation: z.enum(['multiply', 'divide']),
    lhs: z.number().int(),
    rhs: z.number().int(),
  }),
  options: z.array(z.number().int()).length(4),
  answer: z.number().int(),
  issuedAtMs: z.number().int().min(0),
  deadlineMs: z.number().int().min(0),
  targetId: z.string().optional(),
  backHex: axialSchema.optional(),
  pusherHex: axialSchema.optional(),
});
export type BattleTask = z.infer<typeof battleTaskSchema>;

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
  boulders: z.array(boulderSchema).default([]),
  task: battleTaskSchema.optional(),
  taskSeq: z.number().int().min(0).default(0),
  advantage: battleSideSchema.optional(),
  outcome: battleOutcomeSchema.optional(),
});
export type BattleState = z.infer<typeof battleStateSchema>;

export const battleSetupSchema = z.object({
  id: z.string().min(1),
  seed: z.string().min(1),
  board: z.record(z.string(), battleTerrainSchema),
  creatures: z.array(battleCreatureSchema).min(2),
  boulders: z.array(boulderSchema).default([]),
  advantage: battleSideSchema.optional(),
});
export type BattleSetup = z.infer<typeof battleSetupSchema>;
export type BattleSetupInput = z.input<typeof battleSetupSchema>;
