import type HexMapModel from '../map/models/hex-map-model';
import type { HexTileModel } from '../map/models/hex-tile-model';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import {
  EHexCollision,
  EHexobjectGroup,
  type ICreature,
  type THexobject,
} from '../abstraction/hexobject-abstraction';
import { coordinateKey, getHexNeighbors, hexDistance } from '../utils/hex-utils';

/**
 * Who can be attacked, where a shield may be planted, and whether the fight
 * is over.
 *
 * These are map questions, not store questions: each one is answerable from
 * the map plus a coordinate, so the same predicate can back the UI's preview,
 * the store's guard clause, and (later) a server-side check on a co-op
 * client's move — instead of three hand-written versions drifting apart.
 */

const DEFAULT_VISION_RANGE = 3;

export function getCreatureOf(hexobject: THexobject | null | undefined): ICreature | undefined {
  return hexobject?.groupType === EHexobjectGroup.CREATURE ? hexobject.creature : undefined;
}

function isEnemyTile(tile: HexTileModel): boolean {
  return getCreatureOf(tile.hexobject)?.faction === 'enemy';
}

export function isEnemyCreatureTile(tile: HexTileModel | null | undefined): boolean {
  return !!tile && isEnemyTile(tile);
}

/** Every enemy still standing, nearest to the hero first. */
export function findEnemyTiles(map: HexMapModel, heroCoordinates: IHexCoordinates): HexTileModel[] {
  return map.tiles
    .filter((tile) => isEnemyTile(tile))
    .sort(
      (a, b) =>
        hexDistance(a.coordinates, heroCoordinates) - hexDistance(b.coordinates, heroCoordinates),
    );
}

/** Combat ends when no enemy creature is left on the map. */
export function hasLivingEnemies(map: HexMapModel): boolean {
  return map.tiles.some((tile) => isEnemyTile(tile));
}

/** Enemies whose vision range currently covers the hero — the combat trigger. */
export function findEnemyTilesSeeingHero(
  map: HexMapModel,
  heroCoordinates: IHexCoordinates,
): HexTileModel[] {
  return map.tiles.filter((tile) => {
    if (!isEnemyTile(tile)) return false;
    const visionRange = getCreatureOf(tile.hexobject)?.visionRange ?? DEFAULT_VISION_RANGE;
    return hexDistance(tile.coordinates, heroCoordinates) <= visionRange;
  });
}

export function isAdjacentTo(origin: IHexCoordinates, target: IHexCoordinates): boolean {
  const targetKey = coordinateKey(target);
  return getHexNeighbors(origin).some((neighbor) => coordinateKey(neighbor) === targetKey);
}

/**
 * A defend marker needs an adjacent tile the hero can see and that is
 * genuinely empty — a marker on top of an object would be invisible and
 * would block nothing.
 */
export function canPlaceDefendMarkerOn(
  map: HexMapModel,
  heroCoordinates: IHexCoordinates,
  target: IHexCoordinates,
): boolean {
  if (!isAdjacentTo(heroCoordinates, target)) return false;

  const targetKey = coordinateKey(target);
  const tile = map.tiles.find((t) => coordinateKey(t.coordinates) === targetKey);
  if (!tile || !tile.isRevealed) return false;
  if (tile.hexobject?.collision === EHexCollision.SOLID) return false;

  return !tile.hexobject;
}

/** A hero may only swing at an adjacent, living enemy creature. */
export function canAttackTarget(heroCoordinates: IHexCoordinates, target: HexTileModel): boolean {
  if (!isAdjacentTo(heroCoordinates, target.coordinates)) return false;
  return isEnemyCreatureTile(target);
}
