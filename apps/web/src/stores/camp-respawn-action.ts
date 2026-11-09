import type { LocationKey } from '@hexoflat/engine/registry/world-map-registry';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';

export interface CampRespawnHost {
  currentLocationKey: LocationKey;
  currentMapId: string | null;
  pendingCampingRespawn: boolean;
  clearStoredLocation(locationKey: LocationKey, mapId: string): void;
  forgetStoredLocationPosition(locationKey: LocationKey): void;
  stopWorldLoop(): void;
  goToLocation(locationKey: LocationKey): void;
}

export interface CampRespawnDeps {
  hero: {
    heroCoordinates: IHexCoordinates | null;
    closePortalOnDeath(): Promise<void>;
    setPendingLocation(locationKey: LocationKey): void;
    reviveAtOneHp(): void;
  };
  events: { push(source: string, text: string, type: 'BATTLE'): void };
  battle: { close(): void };
  isViewingOtherWorldLocation(locationKey: LocationKey): boolean;
  routeToLocation(locationKey: LocationKey): Promise<void>;
}

export async function respawnHeroAtCampingAction(
  host: CampRespawnHost,
  deps: CampRespawnDeps,
): Promise<void> {
  const { hero, events, battle } = deps;
  const defeatedLocationKey = host.currentLocationKey;
  const defeatedMapId = host.currentMapId;

  battle.close();
  await hero.closePortalOnDeath();
  if (defeatedMapId) {
    host.clearStoredLocation(defeatedLocationKey, defeatedMapId);
  }
  host.forgetStoredLocationPosition('silesia');

  host.stopWorldLoop();
  host.pendingCampingRespawn = true;
  hero.heroCoordinates = null;
  host.currentMapId = null;
  hero.setPendingLocation('camping');
  hero.reviveAtOneHp();
  events.push('Battle', 'hero was defeated and returned to camping', 'BATTLE');

  if (deps.isViewingOtherWorldLocation('camping')) {
    await deps.routeToLocation('camping');
    return;
  }

  host.goToLocation('camping');
}
