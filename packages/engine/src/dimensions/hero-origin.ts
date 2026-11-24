import { EDimension, dimensionSchema } from './dimensions';

export const heroOriginSchema = dimensionSchema;

export const DEFAULT_HERO_ORIGIN: EDimension = EDimension.NOWHERE;

export type HeroOriginRefusal = 'HERO_ORIGIN_IMMUTABLE';

export function heroOriginRefusal(
  stored: EDimension,
  next: EDimension | undefined,
): HeroOriginRefusal | null {
  return next === undefined || next === stored ? null : 'HERO_ORIGIN_IMMUTABLE';
}
