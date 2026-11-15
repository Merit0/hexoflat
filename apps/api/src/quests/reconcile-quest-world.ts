import { randomUUID } from 'node:crypto';
import {
  createServerWorld,
  deserializeWorld,
  installQuestEntrances,
  questPlacementMaps,
  serializeWorld,
  type ProgressState,
} from '@hexoflat/engine';
import { LOCATION_KEYS } from '@hexoflat/engine/registry/location-key';
import {
  deleteServerDocument,
  expeditionSeed,
  readServerDocument,
  writeServerDocument,
} from '../expedition/expedition-store';
import type { Tx } from '../player/aggregate-store';

/** Materialize accepted entrances atomically with the quest-log update. */
export async function reconcileQuestWorld(
  tx: Tx,
  expeditionId: string,
  heroId: string,
  progress: ProgressState,
) {
  const rawQuest = await readServerDocument(tx, expeditionId, 'srv-quest');
  const held = rawQuest
    ? (JSON.parse(rawQuest) as { suspended?: boolean; run: { offerId: string } })
    : null;
  if (
    held?.suspended &&
    !progress.quests.active.some(({ questId }) => questId === held.run.offerId)
  ) {
    await deleteServerDocument(tx, expeditionId, 'srv-quest');
  }
  const rawIndex = await readServerDocument(tx, expeditionId, 'srv-index');
  const index = rawIndex ? (JSON.parse(rawIndex) as Record<string, string>) : {};
  const requested = questPlacementMaps(progress);
  // Existing maps must also be reconciled so abandonment removes old markers.
  const targets = LOCATION_KEYS.filter((key) => index[key] || requested.includes(key));
  for (const targetMap of targets) {
    const rawWorld = index[targetMap]
      ? await readServerDocument(tx, expeditionId, `srv-world:${index[targetMap]}`)
      : null;
    const world = rawWorld
      ? deserializeWorld(JSON.parse(rawWorld), Date.now())
      : createServerWorld(targetMap, randomUUID(), await expeditionSeed(tx, expeditionId), heroId);
    installQuestEntrances(world, progress);
    await writeServerDocument(
      tx,
      expeditionId,
      `srv-world:${world.mapId}`,
      JSON.stringify(serializeWorld(world)),
    );
    index[targetMap] = world.mapId;
  }
  if (!targets.length) return;
  await writeServerDocument(tx, expeditionId, 'srv-index', JSON.stringify(index));
}
