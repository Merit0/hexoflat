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

export const WORLD_ARCHETYPE_KEYS = [
  'FORKED_FRONTIER',
  'RIDGE_AND_POCKET',
  'OPEN_FIELD_NARROW_PASS',
  'LANDMARK_PULL',
] as const;

export const WORLD_PROMISE_TYPES = [
  'LANDMARK_SILHOUETTE',
  'STONE_FORMATION',
  'VEGETATION_SIGNAL',
  'GLOW',
  'SMOKE',
  'OLD_PATH',
  'STREAM',
  'OBELISK_FRAGMENT',
  'FRACTURE_SIGNAL',
] as const;

export const WORLD_PROMISE_STRENGTHS = ['SUBTLE', 'MEDIUM', 'STRONG'] as const;

export type TWorldTerrainKey = (typeof WORLD_TERRAIN_KEYS)[number];
export type TWorldSectionTag = (typeof WORLD_SECTION_TAGS)[number];
export type TWorldTraversability = (typeof WORLD_TRAVERSABILITIES)[number];
export type TWorldArchetypeKey = (typeof WORLD_ARCHETYPE_KEYS)[number];
export type TWorldPromiseType = (typeof WORLD_PROMISE_TYPES)[number];
export type TWorldPromiseStrength = (typeof WORLD_PROMISE_STRENGTHS)[number];

export const WorldTerrainKeySchema = z.enum(WORLD_TERRAIN_KEYS);
export const WorldSectionTagSchema = z.enum(WORLD_SECTION_TAGS);
export const WorldArchetypeKeySchema = z.enum(WORLD_ARCHETYPE_KEYS);
export const WorldPromiseTypeSchema = z.enum(WORLD_PROMISE_TYPES);
export const WorldPromiseStrengthSchema = z.enum(WORLD_PROMISE_STRENGTHS);

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

export const WorldArchetypeDefSchema = z.object({
  key: WorldArchetypeKeySchema,
  requiredTags: z.array(WorldSectionTagSchema).nonempty(),
  weight: z.number().positive(),
});

export const WorldSeamRefSchema = z.object({
  coord: z.object({ columnIndex: z.number().int(), rowIndex: z.number().int() }),
  dir: z.number().int().min(0).max(5),
});

export const WorldPromiseSchema = z.object({
  id: z.string().min(1),
  type: WorldPromiseTypeSchema,
  strength: WorldPromiseStrengthSchema,
  seam: WorldSeamRefSchema,
});

export type WorldTerrainDef = z.infer<typeof WorldTerrainDefSchema>;
export type WorldSectionHex = z.infer<typeof WorldSectionHexSchema>;
export type WorldSectionSeam = z.infer<typeof WorldSectionSeamSchema>;
export type WorldSectionDef = z.infer<typeof WorldSectionDefSchema>;
export type WorldArchetypeDef = z.infer<typeof WorldArchetypeDefSchema>;
export type FrontierPromise = z.infer<typeof WorldPromiseSchema>;
