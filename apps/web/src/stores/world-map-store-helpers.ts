import HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type { HexEngineActionContext } from '@hexoflat/engine';
import { applyCommand } from '@hexoflat/engine';
import type { BoardDescriptor } from '@hexoflat/engine/boards/board-descriptors';
import type { LocationKey } from '@hexoflat/engine/registry/world-map-registry';
import { getWorldSeed } from '@/services/rng/world-rng';
import type { CombatSnapshot } from '@/stores/combat-store';

export type TWorldState = {
  knowledgeRevision?: number;
  contentVersion: number;
  heroCoordinates: IHexCoordinates | null;
  worldSeed?: string;
  descriptor?: BoardDescriptor | null;
} & CombatSnapshot;

export function initialLocationKey(): LocationKey {
  return 'camping';
}

export function requireWorldSeed(): string {
  const seed = getWorldSeed();
  if (!seed) throw new Error('world seed is not set before creating a board');
  return seed;
}

export const MAP_ORIGIN: IHexCoordinates = { columnIndex: 0, rowIndex: 0 };

let isHydratingFromStorage = false;

export function isCurrentlyHydratingFromStorage(): boolean {
  return isHydratingFromStorage;
}

export function withoutCombatAutosave(hydrate: () => void): void {
  isHydratingFromStorage = true;
  try {
    hydrate();
  } finally {
    isHydratingFromStorage = false;
  }
}

export function runWorldTick(map: HexMapModel, now: number, ctx: HexEngineActionContext): boolean {
  const { events } = applyCommand(
    { map, heroes: {} },
    { type: 'WORLD_TICK', payload: { now } },
    ctx,
  );
  const tickEvent = events.find((e) => e.type === 'WORLD_TICKED') as
    { type: 'WORLD_TICKED'; payload: { changed: boolean } } | undefined;

  return tickEvent?.payload.changed ?? false;
}
