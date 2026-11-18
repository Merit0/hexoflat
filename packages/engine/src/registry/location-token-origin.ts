import { ERarityKind } from '../abstraction/hexobject-abstraction';
import type { BoardDescriptor } from '../boards/board-descriptors';
import { MAP_TIERS, type TBaseRealm, type TMapTier } from '../tokens/token-keys';
import { DEFAULT_MAP_TIER, type TokenOrigin } from '../tokens/token-origin';
import { assertNever } from '../utils/assert-never';
import type { BoardKind } from './board-kind';
import type { LocationKey } from './location-key';
import { MapRegistry } from './world-map-registry';

export const CAMP_LOCATION: LocationKey = 'camping';

export function realmOfBoard(board: { boardKind: BoardKind }): TBaseRealm {
  switch (board.boardKind) {
    case 'DUNGEON':
      return ERarityKind.GLOOM;
    case 'STATIC':
      return ERarityKind.IDOL;
    default:
      return assertNever(board.boardKind);
  }
}

function isMapTier(value: unknown): value is TMapTier {
  return (MAP_TIERS as readonly unknown[]).includes(value);
}

export function tierOfBoard(descriptor: BoardDescriptor | null | undefined): TMapTier {
  if (descriptor?.kind !== 'RECIPE') return DEFAULT_MAP_TIER;
  const tier = descriptor.params.tier;
  return isMapTier(tier) ? tier : DEFAULT_MAP_TIER;
}

export function tokenOriginOfBoard(
  board: { boardKind: BoardKind },
  descriptor: BoardDescriptor | null | undefined,
): TokenOrigin {
  return { realm: realmOfBoard(board), mapTier: tierOfBoard(descriptor) };
}

export function locationTokenOrigin(
  locationKey: LocationKey,
  descriptor: BoardDescriptor | null = null,
): TokenOrigin {
  return tokenOriginOfBoard(MapRegistry.get(locationKey), descriptor);
}

export function campTokenOrigin(): TokenOrigin {
  return locationTokenOrigin(CAMP_LOCATION);
}
