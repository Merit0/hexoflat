import { z } from 'zod';

export enum EDimension {
  HEAVEN = 'heaven',
  EARTH = 'earth',
  UNDERWORLD = 'underworld',
  NOWHERE = 'nowhere',
}

export const dimensionSchema = z.enum(EDimension);
export const itemFamilySchema = z.enum(['gloom', 'idol', 'spark', 'alient']);
export type TItemFamily = z.infer<typeof itemFamilySchema>;

/** Ownership is independent of board construction and current location. */
export const DIMENSIONS = Object.freeze({
  [EDimension.HEAVEN]: Object.freeze({ family: 'spark' }),
  [EDimension.EARTH]: Object.freeze({ family: 'idol' }),
  [EDimension.UNDERWORLD]: Object.freeze({ family: 'gloom' }),
  [EDimension.NOWHERE]: Object.freeze({ family: 'alient' }),
} as const satisfies Record<EDimension, { readonly family: TItemFamily }>);

export function itemFamilyOfDimension(dimension: EDimension): TItemFamily {
  return DIMENSIONS[dimensionSchema.parse(dimension)].family;
}
