import { LOCATION_KEYS, type LocationKey } from '@hexoflat/engine/registry/location-key';
import { HOME_LOCATION } from '@hexoflat/engine/world/enter-rule';
import { inventorySession } from '@/services/inventory/inventory-session';

export type HeroElsewhereListener = (held: LocationKey) => void;

let listener: HeroElsewhereListener | null = null;

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
