import {
  newMapId,
  readLocationMapIndex,
  writeLocationMapIndex,
} from '@/services/persistence/world-storage';
import { reseedWorld } from '@/services/rng/world-rng';
import {
  MapRegistry,
  type LocationKey,
  type CreatedBoard,
} from '@hexoflat/engine/registry/world-map-registry';
import { requireWorldSeed } from '@/stores/world-map-store-helpers';

let nextSeedCounter = 0;

export interface DevBoardPanelHost {
  currentLocationKey: LocationKey;
  currentMapId: string | null;
  clearStoredLocation(locationKey: LocationKey, mapId: string): void;
  applyFreshBoard(created: CreatedBoard, mapId: string): void;
  placeHeroAtEntry(locationKey: LocationKey): void;
  revealAroundHero(): void;
  markAllTilesDirty(): void;
  setHeroLocation(locationKey: LocationKey, mapId: string): void;
}

function finishRebuild(host: DevBoardPanelHost, locationKey: LocationKey, mapId: string): void {
  host.placeHeroAtEntry(locationKey);
  host.revealAroundHero();
  host.markAllTilesDirty();
  host.setHeroLocation(locationKey, mapId);
}

/** Dev board panel's "Regenerate": discards the current DUNGEON board and builds a new one under a fresh mapId/seed, as if the hero had just entered. */
export function devRegenerateDungeon(host: DevBoardPanelHost): void {
  const locationKey = host.currentLocationKey;
  const def = MapRegistry.get(locationKey);
  if (def.boardKind !== 'DUNGEON' || !host.currentMapId) return;

  host.clearStoredLocation(locationKey, host.currentMapId);

  const mapId = newMapId();
  const index = readLocationMapIndex();
  index[locationKey] = mapId;
  writeLocationMapIndex(index);
  host.currentMapId = mapId;

  reseedWorld(crypto.randomUUID());
  host.applyFreshBoard(def.create({ seed: requireWorldSeed() }), mapId);
  finishRebuild(host, locationKey, mapId);
}

/** Dev board panel's "Next seed": rebuilds the current DUNGEON board under the same mapId, for quickly cycling through variety. */
export function devNextSeed(host: DevBoardPanelHost): void {
  const locationKey = host.currentLocationKey;
  const def = MapRegistry.get(locationKey);
  if (def.boardKind !== 'DUNGEON' || !host.currentMapId) return;

  nextSeedCounter += 1;
  const seed = `${requireWorldSeed()}:panel:next:${nextSeedCounter}`;
  host.applyFreshBoard(def.create({ seed }), host.currentMapId);
  finishRebuild(host, locationKey, host.currentMapId);
}

/** Dev board panel's "Force layout": rebuilds using exactly the requested layout id. */
export function devForceLayout(host: DevBoardPanelHost, layoutId: string): void {
  const locationKey = host.currentLocationKey;
  const def = MapRegistry.get(locationKey);
  if (!def.createWithLayout || !host.currentMapId) return;

  host.applyFreshBoard(
    def.createWithLayout({ seed: `${requireWorldSeed()}:panel:${layoutId}`, layoutId }),
    host.currentMapId,
  );
  finishRebuild(host, locationKey, host.currentMapId);
}
