export const LOCATION_KEYS = ['camping', 'silesia', 'silesia-north', 'cave'] as const;

export type LocationKey = (typeof LOCATION_KEYS)[number];
