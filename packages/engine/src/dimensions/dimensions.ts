import { ERarityKind } from '../abstraction/hexobject-abstraction';
import { z } from 'zod';

export enum EDimension {
  HEAVEN = 'heaven',
  EARTH = 'earth',
  UNDERWORLD = 'underworld',
  NOWHERE = 'nowhere',
}

export const dimensionSchema = z.enum(EDimension);
export const itemFamilySchema = z.enum(ERarityKind);
export type TItemFamily = z.infer<typeof itemFamilySchema>;

/** Ownership is independent of board construction and current location. */
export const DIMENSIONS = Object.freeze({
  [EDimension.HEAVEN]: Object.freeze({ family: ERarityKind.SPARK }),
  [EDimension.EARTH]: Object.freeze({ family: ERarityKind.IDOL }),
  [EDimension.UNDERWORLD]: Object.freeze({ family: ERarityKind.GLOOM }),
  [EDimension.NOWHERE]: Object.freeze({ family: ERarityKind.ALIEN }),
} as const satisfies Record<EDimension, { readonly family: TItemFamily }>);

export function itemFamilyOfDimension(dimension: EDimension): TItemFamily {
  return DIMENSIONS[dimensionSchema.parse(dimension)].family;
}

export function dimensionOfItemFamily(family: TItemFamily): EDimension {
  const parsed = itemFamilySchema.parse(family);
  const dimension = Object.values(EDimension).find((owner) => DIMENSIONS[owner].family === parsed);
  if (!dimension) throw new Error(`Unknown item family: ${parsed}`);
  return dimension;
}
