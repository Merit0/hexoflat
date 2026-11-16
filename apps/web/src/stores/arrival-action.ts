import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type { LocationKey } from '@hexoflat/engine/registry/world-map-registry';

export interface ArrivalHost {
  placeHeroAtEntry(locationKey: LocationKey): void;
}

export interface ArrivalHero {
  heroCoordinates: IHexCoordinates | null;
}

export function placeHeroOnArrivalAction(
  host: ArrivalHost,
  hero: ArrivalHero,
  locationKey: LocationKey,
): void {
  if (!hero.heroCoordinates) host.placeHeroAtEntry(locationKey);
}
