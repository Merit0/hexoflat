import type { LocationKey } from '../registry/location-key';

const GATES = [
  { from: 'camping', to: 'silesia', key: 'homeland-gate' },
  { from: 'silesia', to: 'camping', key: 'camping-entrance' },
  { from: 'silesia', to: 'cave', key: 'cave-entrance' },
  { from: 'cave', to: 'silesia', key: 'cave-exit' },
] as const;

/** A cross-dimension gate is an explicit endpoint relation, independent of item sharing. */
export function gateConnects(from: LocationKey, to: LocationKey, key: string): boolean {
  return GATES.some((gate) => gate.from === from && gate.to === to && gate.key === key);
}

const PORTAL_LOCATIONS: readonly LocationKey[] = ['silesia', 'silesia-north', 'cave'];

/** The Heaven-owned portal connects existing locations to the Earth camp. */
export function returnPortalConnects(from: LocationKey): boolean {
  return PORTAL_LOCATIONS.includes(from);
}
