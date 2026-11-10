import type { DomainEvent } from '../commands/types';
import type { ProgressState } from '../aggregates/progress-state';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { removeReturnPortal } from '../portal/portal-placement';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { MapRegistry, type LocationKey } from '../registry/world-map-registry';
import type { ServerWorld } from './server-world';

export interface WorldFinders {
  loadStored(locationKey: LocationKey): ServerWorld | null;
  loadById(mapId: string): ServerWorld | null;
  create(locationKey: LocationKey): ServerWorld;
}

interface Removal {
  locationKey: LocationKey;
  mapId: string | null;
  hex: IHexCoordinates;
}

export function removeClosedPortals(
  events: readonly DomainEvent[],
  known: readonly ServerWorld[],
  finders: Pick<WorldFinders, 'loadStored' | 'loadById'>,
): ServerWorld[] {
  const touched: ServerWorld[] = [];
  for (const event of events) {
    if (event.type !== 'PORTAL_CLOSED') continue;
    for (const entry of (event.payload as { remove: Removal[] }).remove) {
      const target =
        known.find(
          (world) =>
            world.locationKey === entry.locationKey &&
            (entry.mapId === null || entry.mapId === world.mapId),
        ) ??
        touched.find((world) => world.locationKey === entry.locationKey) ??
        (entry.mapId ? finders.loadById(entry.mapId) : finders.loadStored(entry.locationKey));
      if (!target || !removeReturnPortal(target.map, entry.hex)) continue;
      if (!known.includes(target) && !touched.includes(target)) touched.push(target);
    }
  }
  return touched;
}

export function leaveOrigin(
  finders: Pick<WorldFinders, 'create'>,
  progress: ProgressState,
  origin: ServerWorld,
  now: number,
): ServerWorld | null {
  const definition = MapRegistry.get(origin.locationKey);
  if (
    definition.respawnAfterClearedMs &&
    origin.map.tiles.some((tile) => tile.hexobject?.hexobjectKey === HEXOBJECT_KEYS.GRAVE)
  ) {
    progress.sealedUntil[origin.locationKey] = now + definition.respawnAfterClearedMs;
  }
  return definition.boardKind === 'DUNGEON' ? finders.create(origin.locationKey) : null;
}
