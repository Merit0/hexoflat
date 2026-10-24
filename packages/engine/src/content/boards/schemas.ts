import { z } from 'zod';
import { hexobjectKeySchema } from '../content-schema';
import { BOARD_COLUMNS, BOARD_ROWS } from '../../boards/board-size';
import { parseBoardRow } from '../../boards/board-rows';

const LEGEND_LETTER = /^[A-Z0-9]$/;

export const LegendEntrySchema = z.object({
  hexobjectKey: hexobjectKeySchema,
  overrides: z.record(z.string(), z.unknown()).optional(),
});
export type LegendEntry = z.infer<typeof LegendEntrySchema>;

const rowsSchema = z
  .array(z.string())
  .max(BOARD_ROWS)
  .refine((rows) => rows.every((row) => parseBoardRow(row).length <= BOARD_COLUMNS), {
    message: `a row has more than ${BOARD_COLUMNS} cells`,
  });

const legendSchema = z.record(z.string().regex(LEGEND_LETTER), LegendEntrySchema);

export const StaticBoardDrawingSchema = z.object({
  id: z.string().min(1),
  background: z.string(),
  legend: legendSchema,
  rows: rowsSchema,
});
export type StaticBoardDrawing = z.infer<typeof StaticBoardDrawingSchema>;

export const BOARD_BIOMES = ['CAVE'] as const;
export const BiomeSchema = z.enum(BOARD_BIOMES);
export type Biome = z.infer<typeof BiomeSchema>;
