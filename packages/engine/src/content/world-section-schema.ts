import { z } from 'zod';

export const WORLD_TERRAIN_KEYS = [
  'OPEN_GROUND',
  'STONE_RIDGE',
  'FOREST_EDGE',
  'BROKEN_GROUND',
  'NARROW_PASS',
  'POCKET_FLOOR',
  'FRONTIER_EDGE',
] as const;

export const WORLD_SECTION_TAGS = [
  'CAMP_ANCHOR',
  'BRANCH',
  'OPEN_AREA',
  'CHOKEPOINT',
  'POCKET',
  'BARRIER',
  'FRONTIER',
] as const;

export const WORLD_TRAVERSABILITIES = ['OPEN', 'BLOCKED', 'RESERVED_INTERACTION'] as const;

export type TWorldTerrainKey = (typeof WORLD_TERRAIN_KEYS)[number];
export type TWorldSectionTag = (typeof WORLD_SECTION_TAGS)[number];
export type TWorldTraversability = (typeof WORLD_TRAVERSABILITIES)[number];

export const WorldTerrainKeySchema = z.enum(WORLD_TERRAIN_KEYS);
export const WorldSectionTagSchema = z.enum(WORLD_SECTION_TAGS);

export const WorldTerrainDefSchema = z.object({
  traversability: z.enum(WORLD_TRAVERSABILITIES),
});

export const WorldSectionHexSchema = z.object({
  q: z.number().int(),
  r: z.number().int(),
  terrain: WorldTerrainKeySchema,
});

export const WorldSectionSeamSchema = z.object({
  q: z.number().int(),
  r: z.number().int(),
  dir: z.number().int().min(0).max(5),
});

export const WorldSectionDefSchema = z.object({
  key: z.string().min(1),
  tags: z.array(WorldSectionTagSchema).nonempty(),
  hexes: z.array(WorldSectionHexSchema).min(4).max(9),
  seams: z.array(WorldSectionSeamSchema).min(1),
  allowRotation: z.boolean(),
  weight: z.number().positive(),
});

export type WorldTerrainDef = z.infer<typeof WorldTerrainDefSchema>;
export type WorldSectionHex = z.infer<typeof WorldSectionHexSchema>;
export type WorldSectionSeam = z.infer<typeof WorldSectionSeamSchema>;
export type WorldSectionDef = z.infer<typeof WorldSectionDefSchema>;
