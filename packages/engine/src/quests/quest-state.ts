import { z } from 'zod';
import { containerStateSchema } from '../containers/container';
import { refineTokenEntry } from '../tokens/token-entry';
import { itemTokenSchema } from '../tokens/token-schema';
import { tokenOriginSchema } from '../tokens/token-origin';
import { mapTierSchema } from '../tokens/token-keys';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { coordinateKey } from '../utils/hex-utils';
import { TERRAIN_IDS } from '../boards/terrain';
import { LOCATION_KEYS } from '../registry/location-key';
import type { SequenceRule } from './sequences/rules';

export const hexSchema = z
  .object({
    columnIndex: z.number().int().min(0).max(255),
    rowIndex: z.number().int().min(0).max(255),
  })
  .strict();

const stepSchema = z.object({ hex: hexSchema, number: z.number().int() }).strict();

const groundItemSchema = z
  .object({
    hex: hexSchema,
    itemKey: z.string().min(1),
    amount: z.number().int().min(1),
    token: itemTokenSchema.optional(),
  })
  .strict()
  .superRefine(refineTokenEntry((item) => item.itemKey));

export const chestDropSchema = z
  .array(
    z
      .object({
        itemKey: z.string().min(1),
        amount: z.number().int().min(1),
        guaranteed: z.boolean(),
      })
      .strict(),
  )
  .min(1);

export const collectSchema = z
  .object({
    hero: hexSchema,
    ground: z.array(groundItemSchema),
    seen: z.array(z.string()),
  })
  .strict();
export type QuestCollect = z.infer<typeof collectSchema>;

const fieldTileSchema = z
  .object({ hex: hexSchema, terrain: z.enum(TERRAIN_IDS).optional() })
  .strict();

export const seekerFieldSchema = z
  .object({
    origin: z.enum(LOCATION_KEYS),
    background: z.string().min(1),
    exit: hexSchema,
    tiles: z.array(fieldTileSchema).min(1),
    mapTier: mapTierSchema.optional(),
    tokenOrigin: tokenOriginSchema.optional(),
  })
  .strict();
export type SeekerField = z.infer<typeof seekerFieldSchema>;

export const SEEKER_OUTCOMES = [
  'treasure',
  'ambushWon',
  'defeat',
  'stranded',
  'left',
  'lost',
] as const;
export type SeekerOutcome = (typeof SEEKER_OUTCOMES)[number];

export const QuestRunSchema = z
  .object({
    offerId: z.string().min(1),
    tokenOrigin: tokenOriginSchema.optional(),
    seed: z.string().min(1),
    rule: z.object({ kind: z.string().min(1) }).passthrough(),
    terms: z.array(z.number().int()).min(1),
    trail: z.array(hexSchema).min(1),
    chestHex: hexSchema,
    chestLootTableId: z.string().min(1).optional(),
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
        drop: chestDropSchema.optional(),
        container: containerStateSchema.optional(),
      })
      .strict()
      .nullable(),
    collect: collectSchema.nullable().default(null),
    phase: z.enum(['walking', 'collect', 'ambush', 'lost', 'ended']),
    outcome: z.enum(SEEKER_OUTCOMES).nullable(),
    resolution: z.enum(['treasure', 'lost']).optional(),
    field: seekerFieldSchema.optional(),
  })
  .strict();

export type QuestRun = Omit<z.infer<typeof QuestRunSchema>, 'rule' | 'collect'> & {
  rule: SequenceRule;
  collect: QuestCollect | null;
};

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
  if (run.collect) return run.collect.hero;
  return run.path.length > 0 ? run.path[run.path.length - 1].hex : run.start;
}
