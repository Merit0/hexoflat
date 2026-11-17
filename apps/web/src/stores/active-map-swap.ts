import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type { BoardDescriptor } from '@hexoflat/engine/boards/board-descriptors';
import type { CreatedBoard, LocationKey } from '@hexoflat/engine/registry/world-map-registry';
import type { ServerWorld } from '@hexoflat/engine/world/server-world';
import type { Engagement } from '@hexoflat/engine/squads/engagement';
import { reseedWorld } from '@/services/rng/world-rng';

export type MapSwap =
  | { kind: 'served'; locationKey: LocationKey; served: ServerWorld }
  | { kind: 'missing'; locationKey: LocationKey }
  | { kind: 'refetched'; served: ServerWorld }
  | { kind: 'fresh'; created: CreatedBoard }
  | { kind: 'cleared' };

type SwapKind = MapSwap['kind'];

interface ActiveMapFields {
  map: unknown;
  descriptor: BoardDescriptor | null;
  currentMapId: string | null;
  currentLocationKey: LocationKey;
  worldLoadFailed: boolean;
}

export interface MapSwapHost extends ActiveMapFields {
  stopWorldLoop(): void;
  cacheServedWorld(engagement?: Engagement | null): void;
  initFog(): void;
  hydrateResourcesFromConfig(): void;
  placeHeroAtEntry(locationKey: LocationKey): void;
  markAllTilesDirty(): void;
  revealAroundHero(): void;
  revealEntryTile(): void;
}

export interface MapSwapDeps {
  hero: {
    heroCoordinates: IHexCoordinates | null;
    setLocation(locationKey: LocationKey, mapId: string): void;
  };
  restoreBattle(engagement: Engagement | null): void;
}

let generation = 0;
let awaited = 0;

export interface MapSwapTicket {
  latest(): boolean;
  settle(): void;
}

export function claimMapSwap(): MapSwapTicket {
  generation += 1;
  const mine = generation;
  awaited = mine;
  return {
    latest: () => mine === generation,
    settle: () => {
      if (awaited === mine) awaited = 0;
    },
  };
}

export function observeMapSwaps(): () => boolean {
  const seen = generation;
  return () => seen === generation && awaited === 0;
}

const CLEARED: ActiveMapFields = {
  map: null,
  descriptor: null,
  currentMapId: null,
  currentLocationKey: 'camping',
  worldLoadFailed: false,
};

function nextFields(host: ActiveMapFields, swap: MapSwap): ActiveMapFields {
  switch (swap.kind) {
    case 'served':
      return {
        map: swap.served.map,
        descriptor: swap.served.descriptor,
        currentMapId: swap.served.mapId,
        currentLocationKey: swap.locationKey,
        worldLoadFailed: false,
      };
    case 'missing':
      return { ...CLEARED, currentLocationKey: swap.locationKey, worldLoadFailed: true };
    case 'refetched':
      return { ...host, map: swap.served.map };
    case 'fresh':
      return { ...host, map: swap.created.map, descriptor: swap.created.descriptor };
    case 'cleared':
      return CLEARED;
  }
}

function assignActiveMap(host: ActiveMapFields, next: ActiveMapFields): void {
  host.map = next.map;
  host.descriptor = next.descriptor;
  host.currentMapId = next.currentMapId;
  host.currentLocationKey = next.currentLocationKey;
  host.worldLoadFailed = next.worldLoadFailed;
}

interface SwapStage {
  kinds: readonly SwapKind[];
  run(host: MapSwapHost, swap: MapSwap, deps: MapSwapDeps): void;
}

function stage<K extends SwapKind>(
  kinds: readonly K[],
  run: (host: MapSwapHost, swap: Extract<MapSwap, { kind: K }>, deps: MapSwapDeps) => void,
): SwapStage {
  return { kinds, run };
}

const SWAP_STAGES: readonly SwapStage[] = [
  stage(['served', 'missing', 'cleared'], (host) => host.stopWorldLoop()),
  stage(['served', 'missing', 'refetched', 'fresh', 'cleared'], (host, swap) =>
    assignActiveMap(host, nextFields(host, swap)),
  ),
  stage(['served', 'refetched'], (_host, swap, deps) => {
    deps.hero.heroCoordinates = swap.served.heroCoordinates;
  }),
  stage(['cleared'], (_host, _swap, deps) => {
    deps.hero.heroCoordinates = null;
  }),
  stage(['served'], (host, swap) => host.cacheServedWorld(swap.served.engagement)),
  stage(['fresh'], (host) => host.initFog()),
  stage(['served', 'fresh'], (host) => host.hydrateResourcesFromConfig()),
  stage(['served'], (_host, swap) => reseedWorld(swap.served.worldSeed ?? crypto.randomUUID())),
  stage(['served'], (_host, swap, deps) => deps.restoreBattle(swap.served.engagement)),
  stage(['served', 'fresh'], (host, swap, deps) => {
    if (swap.kind === 'fresh' || !deps.hero.heroCoordinates) {
      host.placeHeroAtEntry(host.currentLocationKey);
    }
  }),
  stage(['served', 'refetched', 'fresh'], (host) => host.markAllTilesDirty()),
  stage(['served', 'fresh'], (host, _swap, deps) => {
    if (host.currentMapId) deps.hero.setLocation(host.currentLocationKey, host.currentMapId);
  }),
  stage(['served', 'fresh'], (host) => host.revealAroundHero()),
  stage(['served'], (host) => host.revealEntryTile()),
  stage(['served', 'refetched'], (host) => host.cacheServedWorld()),
];

export function swapActiveMap(host: MapSwapHost, swap: MapSwap, deps: MapSwapDeps): void {
  generation += 1;
  awaited = 0;
  for (const step of SWAP_STAGES) {
    if (step.kinds.includes(swap.kind)) step.run(host, swap, deps);
  }
}
