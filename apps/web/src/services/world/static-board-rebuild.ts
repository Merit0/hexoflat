import {
  MapRegistry,
  type LocationKey,
  type CreatedBoard,
} from '@hexoflat/engine/registry/world-map-registry';
import type { BoardDescriptor } from '@hexoflat/engine/boards/board-descriptors';
import { requireWorldSeed } from '@/stores/world-map-store-helpers';

export interface StaticRebuildHost {
  clearStoredLocation(locationKey: LocationKey, mapId: string): void;
  applyFreshBoard(created: CreatedBoard, mapId: string): void;
}

/** B11 — a saved STATIC board remembers the hash of the drawing it was built from; once that drawing changes, its saved copy is stale and gets rebuilt rather than shown as-is. */
export function rebuildStaticIfDrawingChanged(
  host: StaticRebuildHost,
  locationKey: LocationKey,
  mapId: string,
  hasMap: boolean,
  currentDescriptor: BoardDescriptor | null,
): void {
  if (
    !hasMap ||
    currentDescriptor?.kind !== 'STATIC' ||
    currentDescriptor.drawingHash === undefined
  ) {
    return;
  }

  const def = MapRegistry.get(locationKey);
  if (def.boardKind !== 'STATIC') return;

  const fresh = def.create({ seed: requireWorldSeed() });
  if (
    fresh.descriptor.kind !== 'STATIC' ||
    fresh.descriptor.drawingHash === currentDescriptor.drawingHash
  ) {
    return;
  }

  host.clearStoredLocation(locationKey, mapId);
  host.applyFreshBoard(fresh, mapId);
}
