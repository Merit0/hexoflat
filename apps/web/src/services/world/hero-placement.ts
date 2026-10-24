import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type { ExitSide } from '@hexoflat/engine/boards/exits';
import { findFreeHexNearExit, findFreeHexNearObject } from '@hexoflat/engine/map/free-hex-finder';
import { MapRegistry, type LocationKey } from '@hexoflat/engine/registry/world-map-registry';
import type { RandomNumberGenerator } from '@hexoflat/engine/utils/random';

export function findEntryHex(
  map: HexMapModel | null,
  locationKey: LocationKey,
  random: RandomNumberGenerator,
): IHexCoordinates | null {
  if (!map) return null;

  const entryKey = MapRegistry.get(locationKey).entryHexobjectKey;
  const byEntry = entryKey ? findFreeHexNearObject(map, entryKey, random) : null;
  return byEntry ?? findFreeHexNearExit(map, undefined, random);
}

export function findArrivalHex(
  map: HexMapModel | null,
  arrivalSide: ExitSide | null,
  random: RandomNumberGenerator,
): IHexCoordinates | null {
  return map && arrivalSide ? findFreeHexNearExit(map, arrivalSide, random) : null;
}
