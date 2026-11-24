import { z } from 'zod';
import {
  dimensionAllowsTier,
  dimensionSchema,
  uniquesDropAnywhere,
  type EDimension,
} from './dimensions';

const sharedDimensionSchema = dimensionSchema.refine(
  (dimension) => dimensionAllowsTier(dimension, 'base'),
  { error: (issue) => `NO_BASE_TIER: cannot share with ${String(issue.input)}` },
);

export const sharedWithSchema = z.union([
  z.literal('all'),
  z
    .array(sharedDimensionSchema)
    .refine(
      (values) => new Set(values).size === values.length,
      'A shared dimension is listed twice',
    ),
]);

export interface DimensionAvailability {
  dimension: EDimension;
  sharedWith?: z.infer<typeof sharedWithSchema>;
}

/** Sharing permits generation elsewhere; it never changes the item's owner. */
export function availableInDimension(item: DimensionAvailability, source: EDimension): boolean {
  return (
    item.dimension === source ||
    item.sharedWith === 'all' ||
    item.sharedWith?.includes(source) === true
  );
}

export function uniqueAvailableInDimension(
  unique: DimensionAvailability,
  source: EDimension,
): boolean {
  return uniquesDropAnywhere(unique.dimension) || availableInDimension(unique, source);
}
