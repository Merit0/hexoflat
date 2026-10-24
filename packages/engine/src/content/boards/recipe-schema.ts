import { z } from 'zod';
import { hexobjectKeySchema } from '../content-schema';
import { BOARD_COLUMNS, BOARD_ROWS } from '../../boards/board-size';
import { BiomeSchema } from './schemas';

export const STAGE_NAMES = ['form', 'relief', 'bounds', 'gates', 'objects', 'checks'] as const;
export type StageName = (typeof STAGE_NAMES)[number];

export const PieceParamsSchema = z.object({ kind: z.string().min(1) }).passthrough();
export type PieceParams = z.infer<typeof PieceParamsSchema>;

const stageSchema = z.array(PieceParamsSchema);

export const RecipeSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().min(1),
  kind: z.enum(['static', 'generated']),
  frame: z.object({
    columns: z.number().int().min(1).max(BOARD_COLUMNS),
    rows: z.number().int().min(1).max(BOARD_ROWS),
  }),
  biome: BiomeSchema.optional(),
  background: z.string(),
  fog: z.enum(['FOG', 'ALL_REVEALED', 'BY_REGION']),
  willZone: z.enum(['paid', 'free']).optional(),
  entryObject: hexobjectKeySchema.optional(),
  fallbackSeed: z.string().optional(),
  params: z.record(z.string(), z.unknown()).default({}),
  stages: z.object({
    form: stageSchema,
    relief: stageSchema.default([]),
    bounds: stageSchema.default([]),
    gates: stageSchema.default([]),
    objects: stageSchema.default([]),
    checks: stageSchema.default([]),
  }),
});
export type BoardRecipe = z.infer<typeof RecipeSchema>;
export type BoardRecipeInput = z.input<typeof RecipeSchema>;
