import { locationTokenOrigin, campTokenOrigin } from '../registry/location-token-origin';
import { DEFAULT_MAP_TIER, type TokenOrigin } from '../tokens/token-origin';
import type { ContainerTokenSource } from '../containers/create-container';
import { sha256Hex } from '../utils/hash/sha256';
import type { QuestRun } from './quest-state';

const QUEST_RUN_ID_LENGTH = 32;

export function questTokenOrigin(run: Pick<QuestRun, 'field' | 'tokenOrigin'>): TokenOrigin {
  if (run.tokenOrigin) return { ...run.tokenOrigin };
  // Compatibility for fieldless runs authored before location-backed quests; their source was camp.
  if (!run.field) return campTokenOrigin();
  if (run.field.tokenOrigin) return { ...run.field.tokenOrigin };
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
