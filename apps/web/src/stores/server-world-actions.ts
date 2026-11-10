import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type { HexTileModel } from '@hexoflat/engine/map/models/hex-tile-model';
import type { BoardDescriptor } from '@hexoflat/engine/boards/board-descriptors';
import type { Engagement } from '@hexoflat/engine/squads/engagement';
import { getWorldSeed } from '@/services/rng/world-rng';
import type { LocationKey } from '@hexoflat/engine/registry/world-map-registry';
import type { WorldCommandResult } from '@/services/inventory/inventory-sync';
import {
  applyWorldResult,
  buildClientHint,
  hasDueWork,
  serverWorldJson,
  stepOnServerWorld,
  tickServerWorld,
  type ReplayDeps,
} from '@/services/world/served-world';
import { useGameEventsStore } from '@/stores/game-events-store';
import { useGatheringStore } from '@/stores/gathering-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';

const SERVER_TICK_BACKOFF_MS = 2000;
let serverTicking = false;
let serverTickPausedUntil = 0;

export type ServerWorldHero = ReplayDeps['hero'] & {
  heroCoordinates: IHexCoordinates | null;
};

export interface ServerWorldHost {
  map: unknown;
  currentMapId: string | null;
  currentLocationKey: LocationKey;
  getTileAt(coordinates: IHexCoordinates): HexTileModel | null;
  markTilesDirty(coordinates: IHexCoordinates[]): void;
  cacheServedWorld(): void;
}

export function applyWorldResultAction(
  host: ServerWorldHost,
  hero: ServerWorldHero,
  result: WorldCommandResult,
): void {
  if (!host.map) return;
  const deps: ReplayDeps = {
    tool: useHeroToolStore(),
    gathering: useGatheringStore(),
    events: useGameEventsStore(),
    hero,
    tileAt: (coordinates) => host.getTileAt(coordinates),
  };
  host.markTilesDirty(applyWorldResult(host.map as HexMapModel, result, deps));
}

export async function serverTickAction(host: ServerWorldHost, hero: ServerWorldHero) {
  const from = hero.heroCoordinates;
  const now = Date.now();
  if (!host.map || !host.currentMapId || !from || now < serverTickPausedUntil) return;
  if (serverTicking || !hasDueWork(host.map as HexMapModel, now)) return;
  serverTicking = true;
  const mapId = host.currentMapId;
  try {
    const at = { locationKey: host.currentLocationKey, mapId, from };
    const result = await tickServerWorld(at, buildClientHint(useHeroToolStore()));
    if (!result.ok) serverTickPausedUntil = Date.now() + SERVER_TICK_BACKOFF_MS;
    else if (host.currentMapId === mapId) {
      applyWorldResultAction(host, hero, result);
      host.cacheServedWorld();
    }
  } finally {
    serverTicking = false;
  }
}

export async function stepOnServerAction(
  host: ServerWorldHost,
  hero: ServerWorldHero,
  coordinates: IHexCoordinates,
) {
  const from = hero.heroCoordinates;
  if (!host.map || !host.currentMapId || !from) {
    return { ok: false, code: 'NO_WORLD', ambush: null, changed: [] };
  }
  const at = { locationKey: host.currentLocationKey, mapId: host.currentMapId, from };
  const outcome = await stepOnServerWorld({ ...at, map: host.map as HexMapModel }, coordinates);
  host.markTilesDirty(outcome.changed);
  return outcome;
}

export function serverWorldJsonOfHost(
  host: ServerWorldHost & { descriptor: BoardDescriptor | null },
  heroCoordinates: IHexCoordinates | null,
  engagement: Engagement | null,
): string | null {
  if (!host.map || !host.currentMapId) return null;
  return serverWorldJson({
    locationKey: host.currentLocationKey,
    mapId: host.currentMapId,
    map: host.map as HexMapModel,
    descriptor: host.descriptor,
    heroCoordinates,
    worldSeed: getWorldSeed(),
    engagement,
  });
}
