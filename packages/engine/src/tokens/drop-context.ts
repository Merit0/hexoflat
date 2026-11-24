import { ETokenType } from '../abstraction/hexobject-abstraction';
import { z } from 'zod';
import {
  baseTokenTypeSchema,
  mapTierSchema,
  type TBaseTokenType,
  type TMapTier,
} from './token-keys';

export interface DropContext {
  tokenType: TBaseTokenType;
  mapTier: TMapTier;
}

/** Old-save reader: drop contexts stored before DA3b name the token type `realm`. */
export function upcastDropContext(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const { realm, ...rest } = raw as Record<string, unknown>;
  return realm === undefined || 'tokenType' in rest ? raw : { tokenType: realm, ...rest };
}

export const dropContextSchema = z.preprocess(
  upcastDropContext,
  z.strictObject({ tokenType: baseTokenTypeSchema, mapTier: mapTierSchema }),
);

export const DEFAULT_MAP_TIER: TMapTier = 1;

export const DEFAULT_DROP_CONTEXT: DropContext = {
  tokenType: ETokenType.IDOL,
  mapTier: DEFAULT_MAP_TIER,
};
