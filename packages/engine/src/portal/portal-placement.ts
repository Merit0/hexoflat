import { isTerrainPassable } from '../boards/terrain';
import { HexObjectFactory } from '../factory/hex-object-factory';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import type HexMapModel from '../map/models/hex-map-model';
import type { HexTileModel } from '../map/models/hex-tile-model';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { coordinateKey, hexDistance } from '../utils/hex-utils';

function tileAt(map: HexMapModel, at: IHexCoordinates): HexTileModel | undefined {
  const key = coordinateKey(at);
  return map.tiles.find((tile) => coordinateKey(tile.coordinates) === key);
}

function isFreeGround(tile: HexTileModel, occupied: Set<string>): boolean {
  return (
    isTerrainPassable(tile.terrain) &&
    tile.terrain === 'ground' &&
    !tile.exit &&
    !tile.hexobject &&
    !occupied.has(coordinateKey(tile.coordinates))
  );
}

export function findPortalSpot(
  map: HexMapModel,
  desired: IHexCoordinates,
  occupied: IHexCoordinates[] = [],
): IHexCoordinates | null {
  const taken = new Set(occupied.map(coordinateKey));
  const free = map.tiles
    .filter((tile) => isFreeGround(tile, taken))
    .sort(
      (a, b) =>
        hexDistance(a.coordinates, desired) - hexDistance(b.coordinates, desired) ||
        coordinateKey(a.coordinates).localeCompare(coordinateKey(b.coordinates)),
    );
  return free[0] ? { ...free[0].coordinates } : null;
}

export function placeReturnPortal(map: HexMapModel, spot: IHexCoordinates): boolean {
  const tile = tileAt(map, spot);
  if (!tile) return false;
  tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.RETURN_PORTAL, spot);
  return true;
}

export function removeReturnPortal(map: HexMapModel, hex: IHexCoordinates): boolean {
  const tile = tileAt(map, hex);
  if (tile?.hexobject?.hexobjectKey !== HEXOBJECT_KEYS.RETURN_PORTAL) return false;
  tile.hexobject = null;
  return true;
}
