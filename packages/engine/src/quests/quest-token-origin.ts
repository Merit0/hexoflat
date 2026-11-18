import { locationTokenOrigin } from '../registry/location-token-origin';
import { DEFAULT_MAP_TIER, DEFAULT_TOKEN_ORIGIN, type TokenOrigin } from '../tokens/token-origin';
import type { ContainerTokenSource } from '../containers/create-container';
import { sha256Hex } from '../utils/hash/sha256';
import type { QuestRun } from './quest-state';

const QUEST_RUN_ID_LENGTH = 12;

export function questTokenOrigin(run: Pick<QuestRun, 'field'>): TokenOrigin {
  if (!run.field) return DEFAULT_TOKEN_ORIGIN;
  return {
    realm: locationTokenOrigin(run.field.origin).realm,
    mapTier: run.field.mapTier ?? DEFAULT_MAP_TIER,
  };
}

export function questRunId(run: Pick<QuestRun, 'seed'>): string {
  return sha256Hex(`quest-run:${run.seed}`).slice(0, QUEST_RUN_ID_LENGTH);
}

export function questTokenSource(run: Pick<QuestRun, 'seed'>): ContainerTokenSource {
  return { seed: run.seed, scope: [questRunId(run)] };
}
