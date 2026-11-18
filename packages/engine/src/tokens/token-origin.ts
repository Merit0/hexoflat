import { ERarityKind } from '../abstraction/hexobject-abstraction';
import { z } from 'zod';
import { baseRealmSchema, mapTierSchema, type TBaseRealm, type TMapTier } from './token-keys';

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
