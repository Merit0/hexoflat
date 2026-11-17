import { axialToOffset } from '@hexoflat/engine/utils/hex-utils';
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
  refetchServedWorld,
  serverWorldJson,
  stepOnServerWorld,
  tickServerWorld,
  type ReplayDeps,
} from '@/services/world/served-world';
import { i18n } from '@/i18n';
import { containerOpenedOf, planLootFlights } from '@/services/loot/loot-flight';
import { startLootFlights } from '@/services/loot/loot-flight-state';
import { lootRefusalText } from '@/services/loot/loot-rejection';
import { useGameEventsStore } from '@/stores/game-events-store';
import { useGatheringStore } from '@/stores/gathering-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { inventorySession } from '@/services/inventory/inventory-session';
import { holdsMap, holdsPlace } from '@/services/world/held-map';
import { observeMapSwaps, type MapSwap } from '@/stores/active-map-swap';

const SERVER_TICK_BACKOFF_MS = 2000;
let serverTicking = false;
let serverTickPausedUntil = 0;
let refetches = 0;

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
  refetchWorld(): Promise<void>;
}

export function applyWorldResultAction(
  host: ServerWorldHost,
  hero: ServerWorldHero,
  result: WorldCommandResult,
): void {
  if (!host.map || !holdsMap(host, result.mapId)) return;
  if (result.replayed) {
    void host.refetchWorld();
    return;
  }
  const opened = containerOpenedOf(result.events, axialToOffset);
  if (opened) {
    startLootFlights(planLootFlights(opened));
    hero.heroCoordinates = { ...opened.coordinates };
  }
  const deps: ReplayDeps = {
    tool: useHeroToolStore(),
    gathering: useGatheringStore(),
    events: useGameEventsStore(),
    hero,
    tileAt: (coordinates) => host.getTileAt(coordinates),
  };
  host.markTilesDirty(applyWorldResult(host.map as HexMapModel, result, deps));
}

export async function refetchWorldAction(host: ServerWorldHost & { swapMap(swap: MapSwap): void }) {
  if (!host.currentMapId) return;
  refetches += 1;
  const mine = refetches;
  const unchanged = observeMapSwaps();
  const served = await refetchServedWorld();
  if (mine !== refetches || !unchanged() || !served) return;
  host.swapMap(
    holdsPlace(host, served)
      ? { kind: 'refetched', served }
      : { kind: 'served', locationKey: served.locationKey, served },
  );
}

function tickPlaceHeld(host: ServerWorldHost): boolean {
  const presence = inventorySession.presence;
  return !!presence && holdsPlace(host, presence);
}

export async function serverTickAction(host: ServerWorldHost, hero: ServerWorldHero) {
  const from = hero.heroCoordinates;
  const now = Date.now();
  if (!host.map || !host.currentMapId || !from || now < serverTickPausedUntil) return;
  if (!tickPlaceHeld(host)) return;
  if (serverTicking || !hasDueWork(host.map as HexMapModel, now)) return;
  serverTicking = true;
  const mapId = host.currentMapId;
  try {
    const at = { locationKey: host.currentLocationKey, mapId, from };
    const result = await tickServerWorld(at, buildClientHint(useHeroToolStore()));
    if (!result.ok) serverTickPausedUntil = Date.now() + SERVER_TICK_BACKOFF_MS;
    else if (holdsMap(host, mapId)) {
      applyWorldResultAction(host, hero, result);
      host.cacheServedWorld();
      const refused = lootRefusalText(result.events, (key) => i18n.global.t(key));
      if (refused) useHeroToolStore().setActionMessage(refused);
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
  const mapId = host.currentMapId;
  const at = { locationKey: host.currentLocationKey, mapId, map: host.map as HexMapModel };
  const outcome = await stepOnServerWorld(
    { ...at, holds: () => holdsMap(host, mapId) },
    coordinates,
  );
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
