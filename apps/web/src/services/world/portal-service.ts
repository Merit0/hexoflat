import { EHexobjectGroup } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { HexObjectFactory } from '@hexoflat/engine/factory/hex-object-factory';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import type { ISerializedHexMap } from '@hexoflat/engine/map/models/hex-map-model';
import type { HexTileModel } from '@hexoflat/engine/map/models/hex-tile-model';
import type { HeroState } from '@hexoflat/engine/hero-movement/hero-state';
import type { DomainEvent } from '@hexoflat/engine/commands/types';
import { closePortalIfOpen } from '@hexoflat/engine/portal/apply-portal';
import type { PortalLocation } from '@hexoflat/engine/portal/portal-rules';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { MapRegistry, type LocationKey } from '@hexoflat/engine/registry/world-map-registry';
import { readLocationMapIndex, updateSavedMap } from '@/services/persistence/world-storage';
import { isTerrainPassable } from '@hexoflat/engine/boards/terrain';
import { coordinateKey, hexDistance } from '@hexoflat/engine/utils/hex-utils';

export interface PortalRemoval {
  locationKey: LocationKey;
  mapId: string | null;
  hex: IHexCoordinates;
}

export interface PortalClosedPayload {
  heroId: string;
  reason: string;
  remove: PortalRemoval[];
}

export interface PortalWorldPort {
  currentLocationKey: LocationKey;
  currentMapId: string | null;
  map: HexMapModel | null;
  storedMapId: (locationKey: LocationKey) => string | undefined;
  updateStoredMap: (mapId: string, mutate: (map: ISerializedHexMap) => boolean) => boolean;
  markTileDirty: (coordinates: IHexCoordinates) => void;
}

export function portalLocation(locationKey: LocationKey, mapId: string | null): PortalLocation {
  return { locationKey, mapId: mapId ?? '', boardKind: MapRegistry.get(locationKey).boardKind };
}

function tileAt(map: HexMapModel, at: IHexCoordinates): HexTileModel | undefined {
  const key = coordinateKey(at);
  return map.tiles.find((tile) => coordinateKey(tile.coordinates) === key);
}

function isFreeGround(tile: HexTileModel, occupied: Set<string>): boolean {
  return (
    isTerrainPassable(tile.terrain) &&
    tile.terrain === 'ground' &&
    !tile.exit &&
    !tile.hexobject &&
    !occupied.has(coordinateKey(tile.coordinates))
  );
}

export function findPortalSpot(
  map: HexMapModel,
  desired: IHexCoordinates,
  occupied: IHexCoordinates[] = [],
): IHexCoordinates | null {
  const taken = new Set(occupied.map(coordinateKey));
  const free = map.tiles
    .filter((tile) => isFreeGround(tile, taken))
    .sort(
      (a, b) =>
        hexDistance(a.coordinates, desired) - hexDistance(b.coordinates, desired) ||
        coordinateKey(a.coordinates).localeCompare(coordinateKey(b.coordinates)),
    );
  return free[0] ? { ...free[0].coordinates } : null;
}

export function placeReturnPortal(map: HexMapModel, spot: IHexCoordinates): boolean {
  const tile = tileAt(map, spot);
  if (!tile) return false;
  tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.RETURN_PORTAL, spot);
  return true;
}

function removeFromMap(map: HexMapModel, hex: IHexCoordinates): boolean {
  const tile = tileAt(map, hex);
  if (tile?.hexobject?.hexobjectKey !== HEXOBJECT_KEYS.RETURN_PORTAL) return false;
  tile.hexobject = null;
  return true;
}

function removeFromSerialized(map: ISerializedHexMap, hex: IHexCoordinates): boolean {
  const key = coordinateKey(hex);
  const tile = map.tiles.find((candidate) => {
    const at = candidate.coordinates ?? {
      columnIndex: candidate.q ?? Number.NaN,
      rowIndex: candidate.r ?? Number.NaN,
    };
    return coordinateKey(at) === key;
  });
  if (
    !tile?.hexobject ||
    tile.hexobject.groupType !== EHexobjectGroup.CONSTRUCTION ||
    tile.hexobject.hexobjectKey !== HEXOBJECT_KEYS.RETURN_PORTAL
  ) {
    return false;
  }
  tile.hexobject = null;
  return true;
}

export function portalClosedEvents(events: DomainEvent[]): PortalClosedPayload[] {
  return events
    .filter((event) => event.type === 'PORTAL_CLOSED')
    .map((event) => event.payload as PortalClosedPayload);
}

export function applyPortalRemovals(
  closures: PortalClosedPayload[],
  port: PortalWorldPort,
): { touchedCurrent: boolean } {
  let touchedCurrent = false;
  for (const { remove } of closures) {
    for (const entry of remove) {
      const isCurrent =
        entry.locationKey === port.currentLocationKey &&
        (entry.mapId === null || entry.mapId === port.currentMapId);
      if (isCurrent && port.map) {
        if (removeFromMap(port.map, entry.hex)) {
          port.markTileDirty(entry.hex);
          touchedCurrent = true;
        }
        continue;
      }
      const storedId = entry.mapId ?? port.storedMapId(entry.locationKey);
      if (storedId) port.updateStoredMap(storedId, (map) => removeFromSerialized(map, entry.hex));
    }
  }
  return { touchedCurrent };
}

export function closeOnDeath(hero: HeroState, map: HexMapModel): PortalClosedPayload[] {
  const events = closePortalIfOpen({ map, heroes: { [hero.id]: hero } }, hero.id, {
    kind: 'DEATH',
  });
  return portalClosedEvents(events);
}

export interface PortalWorldHost {
  currentLocationKey: LocationKey;
  currentMapId: string | null;
  markTileDirty: (coordinates: IHexCoordinates) => void;
  saveToStorage: () => void;
}

export function applyPortalClosedOnHost(
  host: PortalWorldHost,
  map: HexMapModel | null,
  closures: PortalClosedPayload[],
): void {
  if (!closures.length) return;
  const { touchedCurrent } = applyPortalRemovals(closures, {
    currentLocationKey: host.currentLocationKey,
    currentMapId: host.currentMapId,
    map,
    storedMapId: (locationKey) => readLocationMapIndex()[locationKey],
    updateStoredMap: updateSavedMap,
    markTileDirty: (coordinates) => host.markTileDirty(coordinates),
  });
  if (touchedCurrent) host.saveToStorage();
}

export function closePortalForDeath(
  host: PortalWorldHost,
  map: HexMapModel | null,
  hero: HeroState,
): boolean {
  if (!hero.portal || !map) return false;
  applyPortalClosedOnHost(host, map, closeOnDeath(hero, map));
  return true;
}
