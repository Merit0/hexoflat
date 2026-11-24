import { z } from 'zod';
import { dimensionSchema, uniquesDropAnywhere, type EDimension } from './dimensions';

export const sharedWithSchema = z.union([
  z.literal('all'),
  z
    .array(dimensionSchema)
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
