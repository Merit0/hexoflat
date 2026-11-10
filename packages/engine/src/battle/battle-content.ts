import { z } from 'zod';

export const battleRulesSchema = z.object({
  willPerTurn: z.number().int().positive(),
  stanceMax: z.number().int().min(0),
  step: z.object({
    floor: z.number().int().positive(),
    rubble: z.number().int().positive(),
    climb: z.number().int().positive(),
    descend: z.number().int().positive(),
  }),
  strike: z.number().int().positive(),
  push: z.number().int().positive(),
  blockWindowMs: z.number().int().positive(),
  networkGraceMs: z.number().int().min(0),
  enemyTurnDueMs: z.number().int().positive(),
  swap: z.number().int().positive(),
  taskMs: z.number().int().positive(),
  ledgeStrikeBonus: z.number().int().min(0),
  unarmedPower: z.number().int().positive(),
  maxShieldSides: z.number().int().min(1).max(6),
  boulderWeight: z.number().int().min(0),
  fallDamage: z.number().int().min(0),
});
export type BattleRules = z.infer<typeof battleRulesSchema>;

export const BATTLE_RULES: BattleRules = battleRulesSchema.parse({
  willPerTurn: 20,
  stanceMax: 8,
  step: { floor: 1, rubble: 2, climb: 2, descend: 1 },
  strike: 7,
  push: 6,
  blockWindowMs: 5000,
  networkGraceMs: 500,
  enemyTurnDueMs: 15000,
  swap: 4,
  taskMs: 5000,
  ledgeStrikeBonus: 1,
  unarmedPower: 1,
  maxShieldSides: 6,
  boulderWeight: 2,
  fallDamage: 1,
});
