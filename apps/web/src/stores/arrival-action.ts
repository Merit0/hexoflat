import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type { LocationKey } from '@hexoflat/engine/registry/world-map-registry';

export interface ArrivalHost {
  currentMapId: string | null;
  placeHeroAtEntry(locationKey: LocationKey): void;
}

export interface ArrivalHero {
  heroCoordinates: IHexCoordinates | null;
  nav: { positionByMapId: Record<string, IHexCoordinates | undefined> };
}

export function placeHeroOnArrivalAction(
  host: ArrivalHost,
  hero: ArrivalHero,
  locationKey: LocationKey,
): void {
  const remembered = host.currentMapId ? hero.nav.positionByMapId[host.currentMapId] : null;

  const spot =
    (hero.heroCoordinates ? { ...hero.heroCoordinates } : null) ??
    (remembered ? { ...remembered } : null);
  if (spot) hero.heroCoordinates = spot;
  else host.placeHeroAtEntry(locationKey);
}
