import type HexMapModel from './models/hex-map-model';
import type { HexTileModel } from './models/hex-tile-model';
import type { IHexCoordinates } from './interfaces/hex-tile-config-interface';
import type { IHexMapPlacement } from '../abstraction/hex-map-placement';
import { coordinateKey, getOddQNeighbors } from '../utils/hex-utils';

/**
 * Fog of war: which tiles the hero can see.
 *
 * These are the rules, not the rendering. Each function reveals tiles on the
 * map and returns exactly the coordinates it changed, so the caller can mark
 * only those dirty — it never has to guess, and it never has to re-derive the
 * neighbour math that lives in hex-utils.
 *
 * Living in packages/engine matters beyond tidiness: fog decides what a
 * player is allowed to know, so in co-op it has to be resolvable on the
 * server too, not only inside a Pinia store (architecture rule #4).
 */

function indexByCoordinate(map: HexMapModel): Map<string, HexTileModel> {
  const byKey = new Map<string, HexTileModel>();
  for (const tile of map.tiles) byKey.set(coordinateKey(tile.coordinates), tile);
  return byKey;
}

/**
 * Applies the map's fog policy to every tile. `ALL_REVEALED` maps start fully
 * visible; everything else starts fully hidden.
 */
export function initFog(map: HexMapModel): IHexCoordinates[] {
  const revealed = map.fogPolicy === 'ALL_REVEALED';
  for (const tile of map.tiles) tile.isRevealed = revealed;

  return map.tiles.map((tile) => tile.coordinates);
}

/** Reveals the hero's own tile plus its six neighbours. */
export function revealAroundHero(
  map: HexMapModel,
  heroCoordinates: IHexCoordinates,
): IHexCoordinates[] {
  const byKey = indexByCoordinate(map);
  const revealedCoords: IHexCoordinates[] = [];

  for (const coord of [heroCoordinates, ...getOddQNeighbors(heroCoordinates)]) {
    const tile = byKey.get(coordinateKey(coord));
    if (!tile) continue;
    tile.isRevealed = true;
    revealedCoords.push(tile.coordinates);
  }

  return revealedCoords;
}

/**
 * Reveals one specific tile, but only if the hero could plausibly see it:
 * it must exist, still be hidden, not be the hero's own tile, and be
 * adjacent to the hero. Returns null when nothing changed, which is what
 * lets the caller skip a redundant save.
 */
export function revealTileNextToHero(
  map: HexMapModel,
  heroCoordinates: IHexCoordinates,
  target: IHexCoordinates,
): IHexCoordinates | null {
  const tile = indexByCoordinate(map).get(coordinateKey(target));
  if (!tile || tile.isRevealed) return null;

  const targetKey = coordinateKey(tile.coordinates);
  if (targetKey === coordinateKey(heroCoordinates)) return null;

  const isNeighbor = getOddQNeighbors(heroCoordinates).some(
    (neighbor) => coordinateKey(neighbor) === targetKey,
  );
  if (!isNeighbor) return null;

  tile.isRevealed = true;
  return tile.coordinates;
}

/**
 * Reveals the map's entry tile, preferring a DEFAULT entrance over a SECRET
 * one. Returns null when the map declares no entry placement at all.
 */
export function revealEntryTile(map: HexMapModel): IHexCoordinates | null {
  const entryPlacement: IHexMapPlacement | undefined =
    map.config?.find((placement: IHexMapPlacement) => placement.entry?.type === 'DEFAULT') ??
    map.config?.find((placement: IHexMapPlacement) => placement.entry?.type === 'SECRET');

  const entryCoordinates = entryPlacement?.coordinates?.[0];
  if (!entryCoordinates) return null;

  const tile = indexByCoordinate(map).get(coordinateKey(entryCoordinates));
  if (!tile) return null;

  tile.isRevealed = true;
  return tile.coordinates;
}
