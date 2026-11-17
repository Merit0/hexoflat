import { locationTokenOrigin } from '../registry/location-token-origin';
import { DEFAULT_MAP_TIER, DEFAULT_TOKEN_ORIGIN, type TokenOrigin } from '../tokens/token-origin';
import type { QuestRun } from './quest-state';

export function questTokenOrigin(run: Pick<QuestRun, 'field'>): TokenOrigin {
  if (!run.field) return DEFAULT_TOKEN_ORIGIN;
  return {
    realm: locationTokenOrigin(run.field.origin).realm,
    mapTier: run.field.mapTier ?? DEFAULT_MAP_TIER,
  };
}
