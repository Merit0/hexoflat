import type { BoardDescriptor } from '../boards/board-descriptors';
import { tokenOriginOfBoard, type TokenOrigin } from '../tokens/token-origin';
import type { LocationKey } from './location-key';
import { MapRegistry } from './world-map-registry';

export const CAMP_LOCATION: LocationKey = 'camping';

export function locationTokenOrigin(
  locationKey: LocationKey,
  descriptor: BoardDescriptor | null = null,
): TokenOrigin {
  return tokenOriginOfBoard(MapRegistry.get(locationKey), descriptor);
}

export function campTokenOrigin(): TokenOrigin {
  return locationTokenOrigin(CAMP_LOCATION);
}
