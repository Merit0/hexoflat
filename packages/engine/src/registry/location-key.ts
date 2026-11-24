import { z } from 'zod';
import { EDimension, locationDimensionSchema } from '../dimensions/dimensions';

export const LOCATION_KEYS = ['camping', 'silesia', 'silesia-north', 'cave'] as const;

export type LocationKey = (typeof LOCATION_KEYS)[number];

/** Execution locations; Heaven has no authored location yet. */
export const LOCATION_DIMENSIONS = {
  camping: EDimension.EARTH,
  silesia: EDimension.EARTH,
  'silesia-north': EDimension.EARTH,
  cave: EDimension.UNDERWORLD,
} as const satisfies Record<LocationKey, EDimension>;

export const locationDimensionsSchema = z.record(z.enum(LOCATION_KEYS), locationDimensionSchema);

locationDimensionsSchema.parse(LOCATION_DIMENSIONS);
