import type HexMapModel from '../map/models/hex-map-model';
import type { HexTileModel } from '../map/models/hex-tile-model';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { EHexCollision } from '../abstraction/hexobject-abstraction';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { coordinateKey, getOddQNeighbors } from '../utils/hex-utils';

/**
 * Where a hero materialises on a map: at its entrance, or back at the camp
 * fire after being defeated.
 *
 * Three copies of "find a walkable tile next to X" used to live in
 * world-map-store.ts (entry placement, campfire placement, and the
 * post-load fallback), each subtly free to drift from the others. They are
 * one function here.
 */

/** Returns a float in [0, 1), same contract as `Math.random`. */
export type RandomSource = () => number;

const ORIGIN: IHexCoordinates = { columnIndex: 0, rowIndex: 0 };

function walkableNeighborsOf(map: HexMapModel, coordinates: IHexCoordinates): HexTileModel[] {
  const byKey = new Map<string, HexTileModel>();
  for (const tile of map.tiles) byKey.set(coordinateKey(tile.coordinates), tile);

  return getOddQNeighbors(coordinates)
    .map((coord) => byKey.get(coordinateKey(coord)))
    .filter((tile): tile is HexTileModel => !!tile)
    .filter((tile) => tile.hexobject?.collision !== EHexCollision.SOLID);
}

function findTileByHexobject(map: HexMapModel, hexobjectKey: string): HexTileModel | undefined {
  return map.tiles.find((tile) => tile.hexobject?.hexobjectKey === hexobjectKey);
}

/**
 * Picks a spawn beside the map's entrance, choosing at random among the
 * walkable neighbours so repeat visits don't always start on the same hex.
 *
 * `random` is injected rather than reaching for `Math.random` directly:
 * spawning is game state, and a replay or a co-op client has to be able to
 * arrive at the same tile from the same seed.
 *
 * Falls back to the entrance itself when it is walled in, and to the map
 * origin when the map declares no entrance at all.
 */
export function pickEntrySpawn(
  map: HexMapModel,
  entryHexobjectKey: string,
  random: RandomSource,
): IHexCoordinates {
  const entryTile = findTileByHexobject(map, entryHexobjectKey);
  if (!entryTile) return { ...ORIGIN };

  const neighbors = walkableNeighborsOf(map, entryTile.coordinates);
  if (!neighbors.length) return { ...entryTile.coordinates };

  return { ...neighbors[Math.floor(random() * neighbors.length)].coordinates };
}

/**
 * Picks the first walkable tile beside the entrance. Deliberately
 * deterministic — this is the "we just loaded a map and the hero has no
 * remembered position" fallback, where a stable answer matters more than
 * variety.
 */
export function pickEntrySpawnDeterministic(
  map: HexMapModel,
  entryHexobjectKey: string,
): IHexCoordinates {
  const entryTile = findTileByHexobject(map, entryHexobjectKey);
  if (!entryTile) return { ...ORIGIN };

  const [neighbor] = walkableNeighborsOf(map, entryTile.coordinates);
  return { ...(neighbor?.coordinates ?? entryTile.coordinates) };
}

/**
 * Picks a spawn beside the camp fire. Returns null when the map has no fire
 * place, so the caller can fall back to entry placement instead of guessing.
 */
export function pickCampfireSpawn(map: HexMapModel): IHexCoordinates | null {
  const campfireTile = findTileByHexobject(map, HEXOBJECT_KEYS.FIREPLACE);
  if (!campfireTile) return null;

  const [neighbor] = walkableNeighborsOf(map, campfireTile.coordinates);
  return { ...(neighbor?.coordinates ?? campfireTile.coordinates) };
}
