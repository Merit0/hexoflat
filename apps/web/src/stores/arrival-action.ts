import type { ExitSide } from '@hexoflat/engine/boards/exits';
import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type { LocationKey } from '@hexoflat/engine/registry/world-map-registry';
import { getStream } from '@/services/rng/world-rng';
import { findArrivalHex } from '@/services/world/hero-placement';

export interface ArrivalHost {
  map: unknown;
  currentMapId: string | null;
  pendingArrivalSide: ExitSide | null;
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
    findArrivalHex(host.map as HexMapModel, host.pendingArrivalSide, getStream('world')) ??
    (hero.heroCoordinates ? { ...hero.heroCoordinates } : null) ??
    (remembered ? { ...remembered } : null);
  if (spot) hero.heroCoordinates = spot;
  else host.placeHeroAtEntry(locationKey);

  host.pendingArrivalSide = null;
}
