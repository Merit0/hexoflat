import type { PortalLocation } from '@hexoflat/engine/portal/portal-rules';
import { MapRegistry, type LocationKey } from '@hexoflat/engine/registry/world-map-registry';
import { findPortalSpot, placeReturnPortal } from '@hexoflat/engine/portal/portal-placement';

export { findPortalSpot, placeReturnPortal };

export function portalLocation(locationKey: LocationKey, mapId: string | null): PortalLocation {
  return { locationKey, mapId: mapId ?? '', boardKind: MapRegistry.get(locationKey).boardKind };
}
