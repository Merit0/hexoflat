import type { QuestBoardContext } from '@hexoflat/engine/quests/quest-board';
import { LOCATION_KEYS } from '@hexoflat/engine/registry/location-key';
import { locationDropContext } from '@hexoflat/engine/registry/location-drop-context';
import { dropContextSchema } from '@hexoflat/engine/tokens/drop-context';
import { readServerDocument } from '../expedition/expedition-store';
import type { LoadedAggregate, Tx } from '../player/aggregate-store';
import { isStaleWorldDocument, worldDocumentKey } from '../world/world-documents';

/** The authored destinations are reachable from camp. Prefer the tier of a held world. */
export async function questBoardContext(
  tx: Tx,
  expeditionId: string,
  progress: LoadedAggregate<'progress'>,
): Promise<QuestBoardContext> {
  const { rngSeed } = progress.serverState;
  if (!rngSeed) throw new Error('Progress has no rngSeed');
  const rawIndex = await readServerDocument(tx, expeditionId, 'srv-index');
  const index = rawIndex ? (JSON.parse(rawIndex) as Record<string, string>) : {};
  const dropContexts = await Promise.all(
    LOCATION_KEYS.map(async (key) => {
      const mapId = index[key];
      const raw = mapId
        ? await readServerDocument(tx, expeditionId, worldDocumentKey(mapId))
        : null;
      if (raw && !isStaleWorldDocument(raw)) {
        const { dropContext } = JSON.parse(raw) as { dropContext?: unknown };
        const saved = dropContextSchema.safeParse(dropContext);
        if (saved.success) return [key, saved.data] as const;
      }
      return [key, locationDropContext(key)] as const;
    }),
  );
  return { rngSeed, locationDropContexts: Object.fromEntries(dropContexts) };
}
