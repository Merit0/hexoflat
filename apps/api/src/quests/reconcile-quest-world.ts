import {
  installQuestEntrances,
  isStaleSuspendedRun,
  parseQuestRunDoc,
  questEntrancePlacementIsValid,
  serializeWorld,
  type ProgressState,
} from '@hexoflat/engine';
import { LOCATION_KEYS } from '@hexoflat/engine/registry/location-key';
import {
  deleteServerDocument,
  readServerDocument,
  writeServerDocument,
} from '../expedition/expedition-store';
import type { Tx } from '../player/aggregate-store';
import { loadWorldDocument, worldDocumentKey } from '../world/world-documents';

export class QuestEntrancePlacementError extends Error {
  readonly code = 'NO_ROOM_FOR_QUEST_ENTRANCE';
}

export async function reconcileQuestWorld(
  tx: Tx,
  expeditionId: string,
  progress: ProgressState,
  now: number,
  requiredEntrance?: string,
): Promise<void> {
  const rawQuest = await readServerDocument(tx, expeditionId, 'srv-quest');
  if (rawQuest && isStaleSuspendedRun(parseQuestRunDoc(rawQuest), progress))
    await deleteServerDocument(tx, expeditionId, 'srv-quest');
  const rawIndex = await readServerDocument(tx, expeditionId, 'srv-index');
  const index = rawIndex ? (JSON.parse(rawIndex) as Record<string, string>) : {};
  for (const key of LOCATION_KEYS) {
    const mapId = index[key];
    const world = mapId
      ? await loadWorldDocument(tx, {
          expeditionId,
          heroId: progress.knowledge.heroId,
          mapId,
          now,
        })
      : null;
    if (!world) continue;
    const changed = installQuestEntrances(world, progress);
    if (requiredEntrance && !questEntrancePlacementIsValid(world, progress, requiredEntrance))
      throw new QuestEntrancePlacementError('No reachable tile for the quest entrance');
    if (!changed) continue;
    await writeServerDocument(
      tx,
      expeditionId,
      worldDocumentKey(world.mapId),
      JSON.stringify(serializeWorld(world)),
    );
  }
}
