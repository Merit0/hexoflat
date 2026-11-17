import { ERarityKind } from '../abstraction/hexobject-abstraction';
import type { BoardDescriptor } from '../boards/board-descriptors';
import type { BoardKind } from '../registry/board-kind';
import { assertNever } from '../utils/assert-never';
import { z } from 'zod';
import {
  baseRealmSchema,
  MAP_TIERS,
  mapTierSchema,
  type TBaseRealm,
  type TMapTier,
} from './token-keys';

export interface TokenOrigin {
  realm: TBaseRealm;
  mapTier: TMapTier;
}

export const tokenOriginSchema = z.strictObject({ realm: baseRealmSchema, mapTier: mapTierSchema });

export const DEFAULT_MAP_TIER: TMapTier = 1;

export const DEFAULT_TOKEN_ORIGIN: TokenOrigin = {
  realm: ERarityKind.IDOL,
  mapTier: DEFAULT_MAP_TIER,
};

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
