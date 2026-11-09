import { CONTENT_VERSION } from '@hexoflat/engine';
import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type { BoardDescriptor } from '@hexoflat/engine/boards/board-descriptors';
import type { Engagement } from '@hexoflat/engine/squads/engagement';
import type { LocationKey } from '@hexoflat/engine/registry/world-map-registry';
import { deserializeWorld, type ServerWorld } from '@hexoflat/engine/world/server-world';
import { applyTileDiffs } from '@hexoflat/engine/world/tile-diff';
import { ensurePresence, sendWorldStep } from '@/services/inventory/inventory-sync';
import { cachedWorldJson, forgetServerWorld } from '@/services/player/world-sync';

export function readCachedWorld(locationKey: LocationKey): ServerWorld | null {
  const json = cachedWorldJson(locationKey);
  if (!json) return null;
  try {
    return deserializeWorld(JSON.parse(json), Date.now());
  } catch {
    forgetServerWorld(locationKey);
    return null;
  }
}

export interface ServedWorldView {
  locationKey: LocationKey;
  mapId: string;
  map: HexMapModel;
  descriptor: BoardDescriptor | null;
  heroCoordinates: IHexCoordinates | null;
  worldSeed: string | null;
  engagement: Engagement | null;
}

export function serverWorldJson(view: ServedWorldView): string {
  return JSON.stringify({
    contentVersion: CONTENT_VERSION,
    locationKey: view.locationKey,
    mapId: view.mapId,
    map: view.map,
    descriptor: view.descriptor,
    heroCoordinates: view.heroCoordinates,
    worldSeed: view.worldSeed ?? 'local',
    engagement: view.engagement,
    current: true,
  });
}

export interface ServerStepOutcome {
  ok: boolean;
  code?: string;
  ambush: Engagement | null;
  changed: IHexCoordinates[];
}

export async function stepOnServerWorld(
  at: { locationKey: LocationKey; mapId: string; from: IHexCoordinates; map: HexMapModel },
  target: IHexCoordinates,
): Promise<ServerStepOutcome> {
  await ensurePresence({
    locationKey: at.locationKey,
    mapId: at.mapId,
    coordinates: { ...at.from },
  });
  const result = await sendWorldStep(target);
  if (!result.ok) return { ok: false, code: result.code, ambush: null, changed: [] };
  const changed = applyTileDiffs(at.map, result.tileDiffs, Date.now());
  const ambushed = result.events.some((event) => event.type === 'AMBUSH');
  return { ok: true, ambush: ambushed ? result.engagement : null, changed };
}
