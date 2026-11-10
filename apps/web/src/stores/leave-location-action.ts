import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';

export interface LeaveLocationHost {
  currentMapId: string | null;
  stopWorldLoop(): void;
}

export interface LeaveLocationHero {
  heroCoordinates: IHexCoordinates | null;
  rememberPosition(mapId: string, coordinates: IHexCoordinates): void;
}

export function leaveCurrentLocationAction(host: LeaveLocationHost, hero: LeaveLocationHero): void {
  if (host.currentMapId && hero.heroCoordinates) {
    hero.rememberPosition(host.currentMapId, hero.heroCoordinates);
  }
  host.stopWorldLoop();
}
