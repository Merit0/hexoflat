import {
  deserializeWorld,
  installQuestEntrances,
  isStaleSuspendedRun,
  parseQuestRunDoc,
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

export async function reconcileQuestWorld(
  tx: Tx,
  expeditionId: string,
  progress: ProgressState,
): Promise<void> {
  const rawQuest = await readServerDocument(tx, expeditionId, 'srv-quest');
  if (rawQuest && isStaleSuspendedRun(parseQuestRunDoc(rawQuest), progress))
    await deleteServerDocument(tx, expeditionId, 'srv-quest');
  const rawIndex = await readServerDocument(tx, expeditionId, 'srv-index');
  const index = rawIndex ? (JSON.parse(rawIndex) as Record<string, string>) : {};
  for (const key of LOCATION_KEYS) {
    const mapId = index[key];
    const raw = mapId ? await readServerDocument(tx, expeditionId, `srv-world:${mapId}`) : null;
    if (!raw) continue;
    const world = deserializeWorld(JSON.parse(raw), Date.now());
    if (!installQuestEntrances(world, progress)) continue;
    await writeServerDocument(
      tx,
      expeditionId,
      `srv-world:${world.mapId}`,
      JSON.stringify(serializeWorld(world)),
    );
  }
}
