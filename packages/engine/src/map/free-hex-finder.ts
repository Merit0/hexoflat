import type HexMapModel from './models/hex-map-model';
import type { HexTileModel } from './models/hex-tile-model';
import type { IHexCoordinates } from './interfaces/hex-tile-config-interface';
import { EHexCollision } from '../abstraction/hexobject-abstraction';
import { getOddQNeighbors } from '../utils/hex-utils';
import { pickRandom, type RandomNumberGenerator } from '../utils/random';

/**
 * Finding somewhere on the map an actor can legally stand.
 *
 * This answers a coordinate question only — it never places anything. Who
 * or what ends up on the returned hex, and through which command, is the
 * caller's business: the hero is not a hexobject at all (its position lives
 * outside the tile grid), while creatures and buildings are placed by the
 * world generator, the map schema provider, or a resource feature. Keeping
 * the query separate is what lets all of them share it.
 *
 * "Free" means: the tile exists and nothing solid occupies it.
 */

/**
 * A walkable hex next to `coordinates`, or null when it is walled in.
 *
 * Pass a generator to spread arrivals around instead of always landing on the
 * same side; omit it when a stable answer matters more than variety (the
 * generator injects it, so the choice stays reproducible from a seed).
 */
export function findFreeHexNear(
  map: HexMapModel,
  coordinates: IHexCoordinates,
  random?: RandomNumberGenerator,
): IHexCoordinates | null {
  const free = getOddQNeighbors(coordinates)
    .map((coord) => map.getTileAt(coord))
    .filter((tile): tile is HexTileModel => !!tile)
    .filter((tile) => tile.hexobject?.collision !== EHexCollision.SOLID);

  const chosen = random ? pickRandom(free, random) : (free[0] ?? null);
  return chosen ? { ...chosen.coordinates } : null;
}

/**
 * A walkable hex next to the first tile carrying `hexobjectKey` — the usual
 * way to place someone relative to a landmark such as a gate or a fire.
 *
 * Falls back to the landmark's own tile when it is walled in, and returns
 * null when the map has no such landmark, so callers can tell "nowhere free
 * beside it" apart from "there is no such thing on this map".
 */
export function findFreeHexNearObject(
  map: HexMapModel,
  hexobjectKey: string,
  random?: RandomNumberGenerator,
): IHexCoordinates | null {
  const landmark = map.tiles.find((tile) => tile.hexobject?.hexobjectKey === hexobjectKey);
  if (!landmark) return null;

  return findFreeHexNear(map, landmark.coordinates, random) ?? { ...landmark.coordinates };
}
