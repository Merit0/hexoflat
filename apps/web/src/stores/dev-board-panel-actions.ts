import { reseedWorld } from '@/services/rng/world-rng';
import { MapRegistry, type LocationKey } from '@hexoflat/engine/registry/world-map-registry';
import type { BoardDescriptor } from '@hexoflat/engine/boards/board-descriptors';
import type { BoardRecipeInput } from '@hexoflat/engine/content/boards/recipe-schema';
import { runBoardPipeline } from '@hexoflat/engine/boards/pipeline/run-board-pipeline';
import { requireWorldSeed } from '@/stores/world-map-store-helpers';
import type { MapSwap } from '@/stores/active-map-swap';

let nextSeedCounter = 0;

export type DevRecipeParams = Record<string, unknown>;

export interface DevBoardPanelHost {
  currentLocationKey: LocationKey;
  currentMapId: string | null;
  descriptor: BoardDescriptor | null;
  swapMap(swap: MapSwap): void;
}

/** Dev board panel's "Regenerate": rebuilds the current DUNGEON board in memory under a fresh seed (preview only, the server map is untouched). */
export function devRegenerateDungeon(host: DevBoardPanelHost, params: DevRecipeParams): void {
  const locationKey = host.currentLocationKey;
  const def = MapRegistry.get(locationKey);
  if (def.boardKind !== 'DUNGEON' || !host.currentMapId) return;

  reseedWorld(crypto.randomUUID());
  host.swapMap({
    kind: 'fresh',
    created: def.create({ seed: requireWorldSeed(), params: { ...params } }),
  });
}

/** Dev board panel's "Next seed": rebuilds the current DUNGEON board under the same mapId, for quickly cycling through variety. */
export function devNextSeed(host: DevBoardPanelHost, params: DevRecipeParams): void {
  const locationKey = host.currentLocationKey;
  const def = MapRegistry.get(locationKey);
  if (def.boardKind !== 'DUNGEON' || !host.currentMapId) return;

  nextSeedCounter += 1;
  const seed = `${requireWorldSeed()}:panel:next:${nextSeedCounter}`;
  host.swapMap({ kind: 'fresh', created: def.create({ seed, params: { ...params } }) });
}

export function devRebuildFromRecipe(
  host: DevBoardPanelHost,
  recipe: BoardRecipeInput,
  params: DevRecipeParams,
): void {
  const descriptor = host.descriptor;
  if (descriptor?.kind !== 'RECIPE' || !host.currentMapId) return;

  const created = runBoardPipeline(recipe, { seed: descriptor.seed, params: { ...params } });
  host.swapMap({ kind: 'fresh', created });
}
