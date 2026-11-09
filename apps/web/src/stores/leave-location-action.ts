import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { MapRegistry, type LocationKey } from '@hexoflat/engine/registry/world-map-registry';

export interface LeaveLocationHost {
  currentLocationKey: LocationKey;
  currentMapId: string | null;
  hasGraveMarker(): boolean;
  scheduleLocationRespawn(locationKey: LocationKey, delayMs: number): void;
  clearStoredLocation(locationKey: LocationKey, mapId: string): void;
  saveToStorage(mapId?: string): void;
  stopWorldLoop(): void;
}

export interface LeaveLocationHero {
  heroCoordinates: IHexCoordinates | null;
  rememberPosition(mapId: string, coordinates: IHexCoordinates): void;
}

export function leaveCurrentLocationAction(
  host: LeaveLocationHost,
  hero: LeaveLocationHero,
  nextLocationKey: LocationKey,
  serverTravelled: boolean,
): void {
  const leavingKey = host.currentLocationKey;
  const leavingDef = MapRegistry.get(leavingKey);
  const elsewhere = nextLocationKey !== leavingKey;

  if (!serverTravelled && elsewhere && leavingDef.respawnAfterClearedMs && host.hasGraveMarker()) {
    host.scheduleLocationRespawn(leavingKey, leavingDef.respawnAfterClearedMs);
  }

  if (host.currentMapId) {
    if (hero.heroCoordinates) hero.rememberPosition(host.currentMapId, hero.heroCoordinates);
    if (serverTravelled) {
      host.stopWorldLoop();
      return;
    }
    if (elsewhere && leavingDef.boardKind === 'DUNGEON') {
      host.clearStoredLocation(leavingKey, host.currentMapId);
    } else {
      host.saveToStorage(host.currentMapId);
    }
  }

  host.stopWorldLoop();
}
