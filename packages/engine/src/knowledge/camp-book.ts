import type HexMapModel from '../map/models/hex-map-model';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { getPrototype } from '../content/content-accessors';
import { coordinateKey, getHexNeighbors } from '../utils/hex-utils';

/** Additive facility migration: never rebuild the Camp or replace an occupied tile. */
export function installCampBook(map: HexMapModel, hero: IHexCoordinates | null) {
  if (map.tiles.some((t) => t.hexobject?.hexobjectKey === 'knowledge-book')) return;
  const preferred = map.tiles.find(
    (t) => !t.hexobject && t.coordinates.columnIndex === 10 && t.coordinates.rowIndex === 10,
  );
  const tile =
    preferred ??
    map.tiles.find(
      (t) => !t.hexobject && (!hero || coordinateKey(t.coordinates) !== coordinateKey(hero)),
    );
  if (!tile || (hero && coordinateKey(tile.coordinates) === coordinateKey(hero))) return;
  tile.hexobject = { ...getPrototype('knowledge-book'), id: 'camp-knowledge-book' };
  tile.isRevealed = true;
  return tile.coordinates;
}

export function canReachBook(map: HexMapModel, coordinates: IHexCoordinates | null): boolean {
  if (!coordinates) return false;
  const neighbors = new Set(getHexNeighbors(coordinates).map(coordinateKey));
  return map.tiles.some(
    (tile) =>
      tile.isRevealed &&
      tile.hexobject?.hexobjectKey === 'knowledge-book' &&
      neighbors.has(coordinateKey(tile.coordinates)),
  );
}
