import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import type { THexobject } from '../abstraction/hexobject-abstraction';
import { EHexCollision } from '../abstraction/hexobject-abstraction';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { coordinateKey, getHexNeighbors } from '../utils/hex-utils';

export type TileLike = {
  coordinates: IHexCoordinates;
  isRevealed: boolean;
  hexobject: THexobject | null;
};

export type TileIndex = Map<string, TileLike>;
export type TileMapLike = {
  tiles: TileLike[];
};

export function buildTileIndex(map: TileMapLike): TileIndex {
  const index: TileIndex = new Map<string, TileLike>();

  for (const tile of map.tiles) {
    index.set(coordinateKey(tile.coordinates), tile);
  }

  return index;
}

export function isTraversableTile(tile: TileLike | null | undefined): tile is TileLike {
  if (!tile) return false;
  if (!tile.isRevealed) return false;
  if (tile.hexobject?.collision === EHexCollision.SOLID) return false;
  if (tile.hexobject?.hexobjectKey === HEXOBJECT_KEYS.CAMPING_ENTRANCE) return false;

  return true;
}

export function getTraversableNeighbors(index: TileIndex, center: IHexCoordinates): TileLike[] {
  return getHexNeighbors(center)
    .map((coord) => index.get(coordinateKey(coord)))
    .filter(isTraversableTile);
}
