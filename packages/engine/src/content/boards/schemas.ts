import { z } from 'zod';
import { hexobjectKeySchema } from '../content-schema';

const LEGEND_LETTER = /^[A-Z0-9]$/;
const RESERVED_CHUNK_SYMBOLS = new Set(['T', 'P', 'E', 'D', 'X']);

export const LegendEntrySchema = z.object({
  hexobjectKey: hexobjectKeySchema,
  overrides: z.record(z.string(), z.unknown()).optional(),
});
export type LegendEntry = z.infer<typeof LegendEntrySchema>;

const legendSchema = z.record(z.string().regex(LEGEND_LETTER), LegendEntrySchema);

export const StaticBoardDrawingSchema = z.object({
  id: z.string().min(1),
  background: z.string(),
  legend: legendSchema,
  rows: z.array(z.string()),
});
export type StaticBoardDrawing = z.infer<typeof StaticBoardDrawingSchema>;

export const BOARD_BIOMES = ['CAVE'] as const;
export const BiomeSchema = z.enum(BOARD_BIOMES);
export type Biome = z.infer<typeof BiomeSchema>;

export const BoardChunkSchema = z
  .object({
    id: z.string().min(1),
    biome: BiomeSchema,
    rows: z.array(z.string()),
    legend: legendSchema.optional(),
  })
  .superRefine((chunk, ctx) => {
    for (const letter of Object.keys(chunk.legend ?? {})) {
      if (RESERVED_CHUNK_SYMBOLS.has(letter)) {
        ctx.addIssue({
          code: 'custom',
          message: `chunk "${chunk.id}" legend uses reserved slot/door letter "${letter}"`,
          path: ['legend', letter],
        });
      }
    }
  });
export type BoardChunk = z.infer<typeof BoardChunkSchema>;

export const BoardEdgeSchema = z.enum(['N', 'S', 'E', 'W']);
export type BoardEdge = z.infer<typeof BoardEdgeSchema>;

export const BoardZoneSchema = z.object({
  id: z.string().min(1),
  col: z.number().int().min(0),
  row: z.number().int().min(0),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
});
export type BoardZone = z.infer<typeof BoardZoneSchema>;

export const BoardLinkSchema = z.object({
  from: z.string().min(1),
  fromEdge: BoardEdgeSchema,
  to: z.string().min(1),
  toEdge: BoardEdgeSchema,
});
export type BoardLink = z.infer<typeof BoardLinkSchema>;

export const BoardLayoutSchema = z.object({
  id: z.string().min(1),
  zones: z.array(BoardZoneSchema).min(1),
  links: z.array(BoardLinkSchema),
  entryZone: z.string().min(1),
  depth: z.record(z.string(), z.number().int().min(0)),
});
export type BoardLayout = z.infer<typeof BoardLayoutSchema>;

export const ResourceSlotRuleSchema = z.object({
  hexobjectKey: hexobjectKeySchema,
  min: z.number().int().min(0),
  max: z.number().int().min(0),
});
export type ResourceSlotRule = z.infer<typeof ResourceSlotRuleSchema>;

export const PoiSlotRuleSchema = z.object({
  hexobjectKeys: z.array(hexobjectKeySchema).min(1),
  min: z.number().int().min(0),
  max: z.number().int().min(0),
});
export type PoiSlotRule = z.infer<typeof PoiSlotRuleSchema>;

export const GeneratedBoardPresetSchema = z.object({
  id: z.string().min(1),
  layouts: z.array(z.string().min(1)).min(1),
  biome: BiomeSchema,
  background: z.string(),
  entryObject: hexobjectKeySchema,
  slots: z.object({
    resource: ResourceSlotRuleSchema,
    poi: PoiSlotRuleSchema,
    enemy: ResourceSlotRuleSchema,
  }),
  fallbackChunks: z.record(z.string(), z.record(z.string(), z.string())),
});
export type GeneratedBoardPreset = z.infer<typeof GeneratedBoardPresetSchema>;
