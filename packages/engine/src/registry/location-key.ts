export const LOCATION_KEYS = ['camping', 'silesia', 'silesia-north', 'cave'] as const;

export type LocationKey = (typeof LOCATION_KEYS)[number];

export function isLocationKey(value: string | null | undefined): value is LocationKey {
  return (LOCATION_KEYS as readonly string[]).includes(value ?? '');
}
