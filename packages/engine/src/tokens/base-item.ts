import { sharedWithSchema } from '../dimensions/availability';
import { z } from 'zod';
import { dimensionAllowsTier, dimensionSchema } from '../dimensions/dimensions';
import { attributeKeySchema, itemTypeKeySchema } from './token-keys';

export const baseItemKeySchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

/** Concrete content identity. `type` references shared mechanics, not another dimension's item. */
export const baseItemDefinitionSchema = z.strictObject({
  key: baseItemKeySchema,
  dimension: dimensionSchema.refine(
    (dimension) => dimensionAllowsTier(dimension, 'base'),
    'NOWHERE has no generatable base items',
  ),
  type: itemTypeKeySchema,
  sharedWith: sharedWithSchema.optional(),
  attributes: z
    .array(attributeKeySchema)
    .refine((keys) => new Set(keys).size === keys.length, 'Duplicate base attribute')
    .optional(),
});
export type BaseItemDefinition = z.infer<typeof baseItemDefinitionSchema>;
