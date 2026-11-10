import { reseedWorld } from '@/services/rng/world-rng';
import {
  MapRegistry,
  type LocationKey,
  type CreatedBoard,
} from '@hexoflat/engine/registry/world-map-registry';
import type { BoardDescriptor } from '@hexoflat/engine/boards/board-descriptors';
import type { BoardRecipeInput } from '@hexoflat/engine/content/boards/recipe-schema';
import { runBoardPipeline } from '@hexoflat/engine/boards/pipeline/run-board-pipeline';
import { requireWorldSeed } from '@/stores/world-map-store-helpers';

let nextSeedCounter = 0;

export type DevRecipeParams = Record<string, unknown>;

export interface DevBoardPanelHost {
  currentLocationKey: LocationKey;
  currentMapId: string | null;
  descriptor: BoardDescriptor | null;
  applyFreshBoard(created: CreatedBoard): void;
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

/** Dev board panel's "Regenerate": rebuilds the current DUNGEON board in memory under a fresh seed (preview only, the server map is untouched). */
export function devRegenerateDungeon(host: DevBoardPanelHost, params: DevRecipeParams): void {
  const locationKey = host.currentLocationKey;
  const def = MapRegistry.get(locationKey);
  if (def.boardKind !== 'DUNGEON' || !host.currentMapId) return;

  reseedWorld(crypto.randomUUID());
  host.applyFreshBoard(def.create({ seed: requireWorldSeed(), params: { ...params } }));
  finishRebuild(host, locationKey, host.currentMapId);
}

/** Dev board panel's "Next seed": rebuilds the current DUNGEON board under the same mapId, for quickly cycling through variety. */
export function devNextSeed(host: DevBoardPanelHost, params: DevRecipeParams): void {
  const locationKey = host.currentLocationKey;
  const def = MapRegistry.get(locationKey);
  if (def.boardKind !== 'DUNGEON' || !host.currentMapId) return;

  nextSeedCounter += 1;
  const seed = `${requireWorldSeed()}:panel:next:${nextSeedCounter}`;
  host.applyFreshBoard(def.create({ seed, params: { ...params } }));
  finishRebuild(host, locationKey, host.currentMapId);
}

export function devRebuildFromRecipe(
  host: DevBoardPanelHost,
  recipe: BoardRecipeInput,
  params: DevRecipeParams,
): void {
  const descriptor = host.descriptor;
  if (descriptor?.kind !== 'RECIPE' || !host.currentMapId) return;

  const created = runBoardPipeline(recipe, { seed: descriptor.seed, params: { ...params } });
  host.applyFreshBoard(created);
  finishRebuild(host, host.currentLocationKey, host.currentMapId);
}
