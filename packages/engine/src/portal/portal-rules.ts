import { CAMP_PORTAL_SPOT } from '../content/boards/camp-portal-spot';
import { isTerrainPassable } from '../boards/terrain';
import { getMeta } from '../content/content-accessors';
import { EHexActionType } from '../enums/hex-action-type';
import type { HeroState } from '../hero-movement/hero-state';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import type HexMapModel from '../map/models/hex-map-model';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import type { LocationKey } from '../registry/location-key';
import { coordinateKey, hexDistance } from '../utils/hex-utils';
import { heroPortal, type PortalCloseReason, type PortalLink } from './portal-state';

export type BoardKind = 'STATIC' | 'DUNGEON';

export interface PortalLocation {
  locationKey: LocationKey;
  mapId: string;
  boardKind: BoardKind;
}

export type OpenPortalRejection =
  | 'HERO_NOT_FOUND'
  | 'NO_LOCATION'
  | 'IN_CAMPING'
  | 'IN_COMBAT'
  | 'PORTAL_ALREADY_OPEN'
  | 'NOT_ADJACENT'
  | 'NO_TILE'
  | 'NOT_GROUND'
  | 'TILE_OCCUPIED'
  | 'EXIT_HEX'
  | 'NO_SCROLL'
  | 'INSUFFICIENT_WILL'
  | 'NO_WILL_STATE';

export type EnterPortalRejection =
  'HERO_NOT_FOUND' | 'NO_LOCATION' | 'IN_COMBAT' | 'NO_PORTAL' | 'NOT_ADJACENT' | 'NOT_YOUR_PORTAL';

export function returnScrollWillCost(): number {
  return getMeta(HEXOBJECT_KEYS.RETURN_SCROLL).actions?.[EHexActionType.USE]?.willCost ?? 0;
}

export function planPortalOpening(
  map: HexMapModel,
  hero: HeroState,
  heroes: Record<string, HeroState>,
  target: IHexCoordinates,
  location: PortalLocation,
  combatActive: boolean,
): { ok: true; link: PortalLink } | { ok: false; reason: OpenPortalRejection } {
  if (location.locationKey === 'camping') return { ok: false, reason: 'IN_CAMPING' };
  if (combatActive) return { ok: false, reason: 'IN_COMBAT' };
  if (heroPortal(hero)) return { ok: false, reason: 'PORTAL_ALREADY_OPEN' };
  if (hexDistance(hero.coordinates, target) !== 1) return { ok: false, reason: 'NOT_ADJACENT' };

  const key = coordinateKey(target);
  const tile = map.tiles.find((t) => coordinateKey(t.coordinates) === key);
  if (!tile) return { ok: false, reason: 'NO_TILE' };
  if (tile.terrain !== 'ground' || !isTerrainPassable(tile.terrain)) {
    return { ok: false, reason: 'NOT_GROUND' };
  }
  if (tile.exit) return { ok: false, reason: 'EXIT_HEX' };
  const occupiedByHero = Object.values(heroes).some((h) => coordinateKey(h.coordinates) === key);
  if (tile.hexobject || occupiedByHero) return { ok: false, reason: 'TILE_OCCUPIED' };

  return {
    ok: true,
    link: {
      originLocationKey: location.locationKey,
      originMapId: location.mapId,
      originHex: { ...target },
      campHex: location.boardKind === 'DUNGEON' ? null : { ...CAMP_PORTAL_SPOT },
    },
  };
}

export interface PortalDestination {
  locationKey: LocationKey;
  mapId: string | null;
  arrivalNear: IHexCoordinates | null;
  closesPair: boolean;
}

export function planPortalEntry(
  map: HexMapModel,
  hero: HeroState,
  location: PortalLocation,
  combatActive: boolean,
):
  | { ok: true; destination: PortalDestination; portalHex: IHexCoordinates }
  | {
      ok: false;
      reason: EnterPortalRejection;
    } {
  if (combatActive) return { ok: false, reason: 'IN_COMBAT' };

  const adjacent = map.tiles.filter(
    (t) =>
      t.hexobject?.hexobjectKey === HEXOBJECT_KEYS.RETURN_PORTAL &&
      hexDistance(hero.coordinates, t.coordinates) === 1,
  );
  if (adjacent.length === 0) {
    const anyPortal = map.tiles.some(
      (t) => t.hexobject?.hexobjectKey === HEXOBJECT_KEYS.RETURN_PORTAL,
    );
    return { ok: false, reason: anyPortal ? 'NOT_ADJACENT' : 'NO_PORTAL' };
  }

  const link = heroPortal(hero);
  const owned = link
    ? adjacent.find((t) => isPairPortal(link, location, t.coordinates))
    : undefined;
  if (!link || !owned) return { ok: false, reason: 'NOT_YOUR_PORTAL' };

  if (location.locationKey === 'camping') {
    return {
      ok: true,
      portalHex: { ...owned.coordinates },
      destination: {
        locationKey: link.originLocationKey,
        mapId: link.originMapId,
        arrivalNear: { ...link.originHex },
        closesPair: true,
      },
    };
  }
  return {
    ok: true,
    portalHex: { ...owned.coordinates },
    destination: {
      locationKey: 'camping',
      mapId: null,
      arrivalNear: link.campHex ? { ...link.campHex } : null,
      closesPair: false,
    },
  };
}

function isPairPortal(link: PortalLink, location: PortalLocation, at: IHexCoordinates): boolean {
  if (location.locationKey === 'camping') {
    return !!link.campHex && coordinateKey(link.campHex) === coordinateKey(at);
  }
  return location.mapId === link.originMapId && coordinateKey(link.originHex) === coordinateKey(at);
}

export interface LocationTransition {
  kind: 'ENTER_PORTAL' | 'GATE' | 'DEATH';
}

export function closePortalOnTransition(
  hero: HeroState,
  transition: LocationTransition,
): { closes: false } | { closes: true; reason: PortalCloseReason; link: PortalLink } {
  const link = heroPortal(hero);
  if (!link || transition.kind === 'ENTER_PORTAL') return { closes: false };
  return {
    closes: true,
    reason: transition.kind === 'DEATH' ? 'DEATH' : 'OTHER_GATE',
    link,
  };
}
