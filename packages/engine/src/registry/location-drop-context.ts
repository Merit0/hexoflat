import { tokenTypeOfDimension, type EDimension } from '../dimensions/dimensions';
import type { BoardDescriptor } from '../boards/board-descriptors';
import {
  baseTokenTypeSchema,
  MAP_TIERS,
  type TBaseTokenType,
  type TMapTier,
} from '../tokens/token-keys';
import { DEFAULT_MAP_TIER, type DropContext } from '../tokens/drop-context';
import type { LocationKey } from './location-key';
import { MapRegistry } from './world-map-registry';

export const CAMP_LOCATION: LocationKey = 'camping';

/** Adapter to the existing base-token contract; NOWHERE cannot generate base tokens. */
export function tokenTypeOfBoard(board: { dimension: EDimension }): TBaseTokenType {
  return baseTokenTypeSchema.parse(tokenTypeOfDimension(board.dimension));
}

function isMapTier(value: unknown): value is TMapTier {
  return (MAP_TIERS as readonly unknown[]).includes(value);
}

export function tierOfBoard(descriptor: BoardDescriptor | null | undefined): TMapTier {
  if (descriptor?.kind !== 'RECIPE') return DEFAULT_MAP_TIER;
  const tier = descriptor.params.tier;
  return isMapTier(tier) ? tier : DEFAULT_MAP_TIER;
}

export function dropContextOfBoard(
  board: { dimension: EDimension },
  descriptor: BoardDescriptor | null | undefined,
): DropContext {
  return { tokenType: tokenTypeOfBoard(board), mapTier: tierOfBoard(descriptor) };
}

export function locationDropContext(
  locationKey: LocationKey,
  descriptor: BoardDescriptor | null = null,
): DropContext {
  return dropContextOfBoard(MapRegistry.get(locationKey), descriptor);
}

export function campDropContext(): DropContext {
  return locationDropContext(CAMP_LOCATION);
}
