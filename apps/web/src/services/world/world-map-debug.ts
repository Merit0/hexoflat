import { ref } from 'vue';

export const debugShowTechnicalGrid = ref(false);
export const debugShowGhostLayer = ref(true);

export interface WorldMapDebugDeps {
  regenerate(seed?: string, archetype?: string): void;
  getDescriptor(): {
    seed: string;
    archetype: string;
    versionId: string;
    validation: unknown;
  } | null;
}

export interface WorldMapDebugApi {
  generate(seed?: string): void;
  regenerate(): void;
  nextSeed(): void;
  forceArchetype(archetype: string): void;
  getDescriptor(): unknown;
}

export function createWorldMapDebugApi(deps: WorldMapDebugDeps): WorldMapDebugApi {
  return {
    generate: (seed?: string) => deps.regenerate(seed),
    regenerate: () => deps.regenerate(deps.getDescriptor()?.seed),
    nextSeed: () => deps.regenerate(),
    forceArchetype: (archetype: string) => deps.regenerate(undefined, archetype),
    getDescriptor: () => deps.getDescriptor(),
  };
}

const KEY = '__WORLD_MAP_DEBUG__';

export function installWorldMapDebug(api: WorldMapDebugApi): void {
  (window as unknown as Record<string, unknown>)[KEY] = api;
  console.info(`[world-map] debug API ready — window.${KEY}`);
}

export function uninstallWorldMapDebug(): void {
  delete (window as unknown as Record<string, unknown>)[KEY];
}
