import { z } from 'zod';
import { priceRangeSchema, type PriceRange } from '../dimensions/dimensions';
import { EHexActionType } from '../enums/hex-action-type';
import { equipmentTypeFieldShape } from './equipment/equipment-keys';
import {
  BASE_TOKEN_TYPES,
  baseTokenTypeSchema,
  itemTypeKeySchema,
  wordKeySchemaFor,
  type TBaseTokenType,
} from './token-keys';

function distinct<T>(values: readonly T[]): boolean {
  return new Set(values).size === values.length;
}

export const ITEM_SLOTS = ['weapon', 'shield', 'any'] as const;
export type TItemSlot = (typeof ITEM_SLOTS)[number];
export const TOOL_ACTIONS = [EHexActionType.CUT, EHexActionType.MINE] as const;

export const itemTypeDefinitionSchema = z.strictObject({
  key: itemTypeKeySchema,
  slot: z.enum(ITEM_SLOTS),
  strike: z.number().int().positive(),
  block: z.strictObject({ sides: z.number().int().positive() }).optional(),
  tool: z
    .strictObject({
      action: z.enum(TOOL_ACTIONS),
      durabilityCostPct: z.number().positive().max(1),
    })
    .nullable(),
  nounKey: wordKeySchemaFor('noun'),
  tokenTypes: z.array(baseTokenTypeSchema).min(1).refine(distinct, 'a token type is listed twice'),
  group: equipmentTypeFieldShape.group.optional(),
  gender: equipmentTypeFieldShape.gender.optional(),
  materials: equipmentTypeFieldShape.materials.optional(),
  enabled: equipmentTypeFieldShape.enabled.optional(),
  base: equipmentTypeFieldShape.base,
});
export type ItemTypeDefinition = z.infer<typeof itemTypeDefinitionSchema>;

export function hasGeneratedName(type: ItemTypeDefinition): boolean {
  return type.tool === null;
}

export { priceRangeSchema, type PriceRange };

export const tokenPriceRangesSchema = z.strictObject(
  Object.fromEntries(BASE_TOKEN_TYPES.map((tokenType) => [tokenType, priceRangeSchema])) as Record<
    TBaseTokenType,
    typeof priceRangeSchema
  >,
);
export type TokenPriceRanges = z.infer<typeof tokenPriceRangesSchema>;

const wordThemeSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const prefixWordSchema = z.strictObject({
  key: wordKeySchemaFor('prefix'),
  tokenTypes: z
    .array(baseTokenTypeSchema)
    .min(1)
    .refine(distinct, 'a token type is listed twice')
    .optional(),
  theme: wordThemeSchema.optional(),
});
export const suffixWordSchema = z.strictObject({
  key: wordKeySchemaFor('suffix'),
  tokenTypes: z
    .array(baseTokenTypeSchema)
    .min(1)
    .refine(distinct, 'a token type is listed twice')
    .optional(),
  theme: wordThemeSchema.optional(),
});

export type TokenWord = z.infer<typeof prefixWordSchema>;

export const wordPoolDataSchema = z.strictObject({
  prefixes: z.array(prefixWordSchema),
  suffixes: z.array(suffixWordSchema),
});
export type WordPoolData = z.infer<typeof wordPoolDataSchema>;
