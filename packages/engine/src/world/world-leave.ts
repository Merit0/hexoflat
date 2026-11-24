import type { DomainEvent } from '../commands/types';
import type { ProgressState } from '../aggregates/progress-state';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { removeReturnPortal } from '../portal/portal-placement';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import type { BoardKind } from '../registry/board-kind';
import { MapRegistry, type LocationKey } from '../registry/world-map-registry';
import { assertNever } from '../utils/assert-never';
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

export function leaveDepartedWorld(
  finders: Pick<WorldFinders, 'create'>,
  progress: ProgressState,
  departed: ServerWorld,
  now: number,
): ServerWorld | null {
  const definition = MapRegistry.get(departed.locationKey);
  if (
    definition.respawnAfterClearedMs &&
    departed.map.tiles.some((tile) => tile.hexobject?.hexobjectKey === HEXOBJECT_KEYS.GRAVE)
  ) {
    progress.sealedUntil[departed.locationKey] = now + definition.respawnAfterClearedMs;
  }
  return freshAfterLeave(definition.boardKind) ? finders.create(departed.locationKey) : null;
}

function freshAfterLeave(kind: BoardKind): boolean {
  switch (kind) {
    case 'DUNGEON':
      return true;
    case 'STATIC':
      return false;
    default:
      return assertNever(kind);
  }
}
