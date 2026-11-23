import type { QuestBoardContext } from '@hexoflat/engine/quests/quest-board';
import { LOCATION_KEYS } from '@hexoflat/engine/registry/location-key';
import { locationTokenOrigin } from '@hexoflat/engine/registry/location-token-origin';
import { tokenOriginSchema } from '@hexoflat/engine/tokens/token-origin';
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
  const origins = await Promise.all(
    LOCATION_KEYS.map(async (key) => {
      const mapId = index[key];
      const raw = mapId
        ? await readServerDocument(tx, expeditionId, worldDocumentKey(mapId))
        : null;
      if (raw && !isStaleWorldDocument(raw)) {
        const { tokenOrigin } = JSON.parse(raw) as { tokenOrigin?: unknown };
        const saved = tokenOriginSchema.safeParse(tokenOrigin);
        if (saved.success) return [key, saved.data] as const;
      }
      return [key, locationTokenOrigin(key)] as const;
    }),
  );
  return { rngSeed, locationOrigins: Object.fromEntries(origins) };
}
