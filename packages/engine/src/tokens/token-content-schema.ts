import { z } from 'zod';
import { ERarityKind } from '../abstraction/hexobject-abstraction';
import { EHexActionType } from '../enums/hex-action-type';
import {
  attributeKeySchema,
  baseRealmSchema,
  itemTypeKeySchema,
  wordKeySchemaFor,
} from './token-keys';

function distinct<T>(values: readonly T[]): boolean {
  return new Set(values).size === values.length;
}

export const ITEM_SLOTS = ['weapon', 'shield'] as const;
export const TOOL_ACTIONS = [EHexActionType.CUT, EHexActionType.MINE] as const;

export const itemTypeDefinitionSchema = z.strictObject({
  key: itemTypeKeySchema,
  slot: z.enum(ITEM_SLOTS),
  strike: z.number().int().positive(),
  block: z.strictObject({ sides: z.number().int().positive() }).optional(),
  tool: z.strictObject({ action: z.enum(TOOL_ACTIONS) }).nullable(),
  nounKey: wordKeySchemaFor('noun'),
  realms: z.array(baseRealmSchema).min(1).refine(distinct, 'a realm is listed twice'),
});
export type ItemTypeDefinition = z.infer<typeof itemTypeDefinitionSchema>;

export function hasGeneratedName(type: ItemTypeDefinition): boolean {
  return type.tool === null;
}

const tierValueSchema = z.number().int().positive();

export const ATTRIBUTE_UNITS = ['half-heart', 'point'] as const;
export type TAttributeUnit = (typeof ATTRIBUTE_UNITS)[number];

export const attributeDefinitionSchema = z.strictObject({
  key: attributeKeySchema,
  valueByTier: z.strictObject({
    1: tierValueSchema,
    2: tierValueSchema,
    3: tierValueSchema,
    4: tierValueSchema,
  }),
  weight: z.number().int().positive(),
  allowedTypes: z.array(itemTypeKeySchema).refine(distinct, 'a type is listed twice').optional(),
  implemented: z.boolean(),
  unit: z.enum(ATTRIBUTE_UNITS).optional(),
});
export type AttributeDefinition = z.infer<typeof attributeDefinitionSchema>;

const priceRangeSchema = z
  .tuple([z.number().int().positive(), z.number().int().positive()])
  .refine(([min, max]) => min <= max, 'min is above max');
export type PriceRange = z.infer<typeof priceRangeSchema>;

export const tokenPriceRangesSchema = z.strictObject({
  [ERarityKind.GLOOM]: priceRangeSchema,
  [ERarityKind.IDOL]: priceRangeSchema,
  [ERarityKind.SPARK]: priceRangeSchema,
});
export type TokenPriceRanges = z.infer<typeof tokenPriceRangesSchema>;

const wordThemeSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const prefixWordSchema = z.strictObject({
  key: wordKeySchemaFor('prefix'),
  realms: z.array(baseRealmSchema).min(1).refine(distinct, 'a realm is listed twice').optional(),
  theme: wordThemeSchema.optional(),
});
export const suffixWordSchema = z.strictObject({
  key: wordKeySchemaFor('suffix'),
  realms: z.array(baseRealmSchema).min(1).refine(distinct, 'a realm is listed twice').optional(),
  theme: wordThemeSchema.optional(),
});

export function sharesTheme(first: TokenWord, second: TokenWord): boolean {
  return first.theme !== undefined && first.theme === second.theme;
}
export type TokenWord = z.infer<typeof prefixWordSchema>;

export const wordPoolDataSchema = z.strictObject({
  prefixes: z.array(prefixWordSchema),
  suffixes: z.array(suffixWordSchema),
});
export type WordPoolData = z.infer<typeof wordPoolDataSchema>;
