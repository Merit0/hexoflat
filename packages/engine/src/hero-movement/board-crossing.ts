import type HexMapModel from '../map/models/hex-map-model';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import type { ExitSide } from '../boards/exits';
import { arrivalSideFor, atlasNeighbour } from '../content/boards/atlas';
import { findFreeHexNearExit } from '../map/free-hex-finder';
import type { LocationKey } from '../registry/location-key';
import { coordinateKey } from '../utils/hex-utils';

export type BoardCrossingRejection = 'NOT_ON_EXIT' | 'NO_NEIGHBOUR' | 'SEALED' | 'IN_COMBAT';

export interface BoardCrossing {
  from: LocationKey;
  to: LocationKey;
  exitSide: ExitSide;
  arrivalSide: ExitSide;
  restingSpot: IHexCoordinates | null;
}

export interface BoardCrossingRules {
  combatActive: boolean;
  isLocationSealed: (locationKey: LocationKey) => boolean;
}

export function planBoardCrossing(
  map: HexMapModel,
  heroCoordinates: IHexCoordinates,
  from: LocationKey,
  rules: BoardCrossingRules,
): { ok: true; crossing: BoardCrossing } | { ok: false; reason: BoardCrossingRejection } {
  if (rules.combatActive) return { ok: false, reason: 'IN_COMBAT' };

  const heroKey = coordinateKey(heroCoordinates);
  const exitSide = map.tiles.find((tile) => coordinateKey(tile.coordinates) === heroKey)?.exit;
  if (!exitSide) return { ok: false, reason: 'NOT_ON_EXIT' };

  const to = atlasNeighbour(from, exitSide);
  if (!to) return { ok: false, reason: 'NO_NEIGHBOUR' };
  if (rules.isLocationSealed(to)) return { ok: false, reason: 'SEALED' };

  return {
    ok: true,
    crossing: {
      from,
      to,
      exitSide,
      arrivalSide: arrivalSideFor(exitSide),
      restingSpot: findFreeHexNearExit(map, exitSide),
    },
  };
}
