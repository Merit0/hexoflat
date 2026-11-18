import { Logger } from '@nestjs/common';
import {
  createServerWorld,
  deserializeWorld,
  serializeWorld,
  staleWorldOf,
  type ServerWorld,
} from '@hexoflat/engine';
import {
  expeditionSeed,
  readServerDocument,
  writeServerDocument,
} from '../expedition/expedition-store';
import type { Tx } from '../player/aggregate-store';

const logger = new Logger('WorldDocuments');

export const worldDocumentKey = (mapId: string) => `srv-world:${mapId}`;

export function isStaleWorldDocument(raw: string): boolean {
  return staleWorldOf(JSON.parse(raw)) !== null;
}

export async function loadWorldDocument(
  tx: Tx,
  input: { expeditionId: string; heroId: string; mapId: string; now: number },
): Promise<ServerWorld | null> {
  const raw = await readServerDocument(tx, input.expeditionId, worldDocumentKey(input.mapId));
  if (!raw) return null;
  const parsed: unknown = JSON.parse(raw);
  const stale = staleWorldOf(parsed);
  if (!stale) return deserializeWorld(parsed, input.now);
  logger.warn(
    `Stale world ${stale.mapId} (${stale.locationKey}, content version ${String(stale.found)}) replaced by a fresh map`,
  );
  const fresh = createServerWorld(
    stale.locationKey,
    stale.mapId,
    await expeditionSeed(tx, input.expeditionId),
    input.heroId,
  );
  await writeServerDocument(
    tx,
    input.expeditionId,
    worldDocumentKey(fresh.mapId),
    JSON.stringify(serializeWorld(fresh)),
  );
  return fresh;
}
