import { locationDropContext, campDropContext } from '../registry/location-drop-context';
import { DEFAULT_MAP_TIER, type DropContext } from '../tokens/drop-context';
import type { ContainerTokenSource } from '../containers/create-container';
import { sha256Hex } from '../utils/hash/sha256';
import type { QuestRun } from './quest-state';

const QUEST_RUN_ID_LENGTH = 32;

export function questDropContext(run: Pick<QuestRun, 'field' | 'dropContext'>): DropContext {
  if (run.dropContext) return { ...run.dropContext };
  // Compatibility for fieldless runs authored before location-backed quests; their source was camp.
  if (!run.field) return campDropContext();
  if (run.field.dropContext) return { ...run.field.dropContext };
  return {
    tokenType: locationDropContext(run.field.origin).tokenType,
    mapTier: run.field.mapTier ?? DEFAULT_MAP_TIER,
  };
}

export function questRunId(run: Pick<QuestRun, 'seed'>): string {
  return sha256Hex(`quest-run:${run.seed}`).slice(0, QUEST_RUN_ID_LENGTH);
}

export function questTokenSource(run: Pick<QuestRun, 'seed'>): ContainerTokenSource {
  return { seed: run.seed, scope: [questRunId(run)] };
}
