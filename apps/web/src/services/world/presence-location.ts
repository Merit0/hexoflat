import { LOCATION_KEYS, type LocationKey } from '@hexoflat/engine/registry/location-key';
import { HOME_LOCATION } from '@hexoflat/engine/world/enter-rule';
import { inventorySession } from '@/services/inventory/inventory-session';

export type HeroElsewhereListener = (held: LocationKey) => void;

let listener: HeroElsewhereListener | null = null;
let mapListener: (() => void) | null = null;
let acceptListener: (() => void) | null = null;

export function heldLocationKey(): LocationKey | null {
  const key = inventorySession.presence?.locationKey ?? '';
  return (LOCATION_KEYS as readonly string[]).includes(key) ? (key as LocationKey) : null;
}

export function onHeroElsewhere(next: HeroElsewhereListener | null): void {
  listener = next;
}

export function reportHeroElsewhere(): void {
  listener?.(heldLocationKey() ?? HOME_LOCATION);
}

export function onMapMismatch(next: (() => void) | null): void {
  mapListener = next;
}

export function reportMapMismatch(): void {
  mapListener?.();
}

export function onMapAccepted(next: (() => void) | null): void {
  acceptListener = next;
}

export function reportMapAccepted(): void {
  acceptListener?.();
}

let arrivals = 0;

export function expectArrival(): () => void {
  arrivals += 1;
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    arrivals -= 1;
  };
}

export function arrivalTarget(): LocationKey | null {
  return arrivals > 0 ? heldLocationKey() : null;
}
