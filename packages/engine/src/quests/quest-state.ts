import { z } from 'zod';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { coordinateKey } from '../utils/hex-utils';
import type { SequenceRule } from './sequences/rules';

export const hexSchema = z
  .object({
    columnIndex: z.number().int().min(0).max(255),
    rowIndex: z.number().int().min(0).max(255),
  })
  .strict();

const stepSchema = z.object({ hex: hexSchema, number: z.number().int() }).strict();

export const SEEKER_OUTCOMES = ['treasure', 'ambushWon', 'defeat', 'stranded', 'left'] as const;
export type SeekerOutcome = (typeof SEEKER_OUTCOMES)[number];

export const QuestRunSchema = z
  .object({
    offerId: z.string().min(1),
    seed: z.string().min(1),
    rule: z.object({ kind: z.string().min(1) }).passthrough(),
    terms: z.array(z.number().int()).min(1),
    trail: z.array(hexSchema).min(1),
    chestHex: hexSchema,
    start: hexSchema,
    stepCost: z.number().int().min(1),
    backMultiplier: z.number().int().min(1),
    hintSteps: z.number().int().min(0),
    maxDigits: z.number().int().min(1),
    path: z.array(stepSchema),
    lines: z.array(
      z.object({ fromStep: z.number().int().min(1), values: z.array(z.number().int()) }).strict(),
    ),
    everDeviated: z.boolean(),
    steppedBack: z.boolean(),
    firstDeviation: z
      .object({ number: z.number().int(), expected: z.number().int() })
      .strict()
      .nullable(),
    stepsTaken: z.number().int().nonnegative(),
    deviationsTotal: z.number().int().nonnegative(),
    revealed: z.record(
      z.string(),
      z.object({ number: z.number().int(), revealedBy: z.string() }).strict(),
    ),
    visited: z.array(z.string()),
    chest: z
      .object({
        hex: hexSchema,
        kind: z.enum(['real', 'lure']),
        appearedAtStep: z.number().int().nonnegative(),
      })
      .strict()
      .nullable(),
    phase: z.enum(['walking', 'collect', 'ambush', 'ended']),
    outcome: z.enum(SEEKER_OUTCOMES).nullable(),
  })
  .strict();

export type QuestRun = Omit<z.infer<typeof QuestRunSchema>, 'rule'> & { rule: SequenceRule };

export function parseQuestRun(raw: unknown): QuestRun {
  return QuestRunSchema.parse(raw) as unknown as QuestRun;
}

export interface SeekerBoard {
  floor: readonly IHexCoordinates[];
}

export function floorKeys(board: SeekerBoard): Set<string> {
  return new Set(board.floor.map(coordinateKey));
}

export function positionOf(run: QuestRun): IHexCoordinates {
  return run.path.length > 0 ? run.path[run.path.length - 1].hex : run.start;
}
