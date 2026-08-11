import type HexMapModel from '../map/models/hex-map-model';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { EHexCollision } from '../abstraction/hexobject-abstraction';
import { coordinateKey, getOddQNeighbors, hexDistance } from '../utils/hex-utils';
import { findShortestPath } from '../hero-movement/pathfinding-service';

/**
 * What an enemy decides to do on its turn.
 *
 * Deciding and doing are split on purpose. Everything here is a pure
 * function of the map, the two positions, the step budget and an injected
 * random source — so an enemy turn can be unit-tested with a fixed seed, and
 * replayed identically. Carrying the decision out (walking the route,
 * waiting between steps, pushing log lines, saving) stays in apps/web, where
 * the animation clock lives.
 *
 * This deliberately does NOT go through applyCommand: per CLAUDE.md, combat
 * is not on the engine's command/event pipeline until the combat design is
 * settled. Moving the arithmetic out is structural, not that migration.
 */

export interface EnemyMoveOption {
  coord: IHexCoordinates;
  /** Steps to walk, excluding the enemy's current tile. */
  route: IHexCoordinates[];
}

/**
 * Tiles adjacent to the hero that this enemy could attack from, together
 * with how it would get there. Its current tile counts with an empty route
 * when it already stands next to the hero.
 */
export function findAttackOptions(
  map: HexMapModel,
  enemyCoordinates: IHexCoordinates,
  heroCoordinates: IHexCoordinates,
  stepBudget: number,
): EnemyMoveOption[] {
  const enemyKey = coordinateKey(enemyCoordinates);

  return getOddQNeighbors(heroCoordinates)
    .map((coord): EnemyMoveOption | null => {
      const coordKey = coordinateKey(coord);
      const tile = map.tiles.find((t) => coordinateKey(t.coordinates) === coordKey);
      if (!tile) return null;

      if (coordKey === enemyKey) return { coord: { ...coord }, route: [] };

      if (!tile.isRevealed) return null;
      if (tile.hexobject?.collision === EHexCollision.SOLID) return null;

      const path = findShortestPath(map, enemyCoordinates, coord, stepBudget);
      if (!path || path.length < 2) return null;

      return { coord: { ...coord }, route: path.slice(1) };
    })
    .filter((option): option is EnemyMoveOption => !!option);
}

/**
 * Tiles the enemy could withdraw to after striking: revealed, empty, and out
 * of the hero's reach.
 */
export function findRetreatOptions(
  map: HexMapModel,
  enemyCoordinates: IHexCoordinates,
  heroCoordinates: IHexCoordinates,
  stepBudget: number,
): EnemyMoveOption[] {
  const enemyKey = coordinateKey(enemyCoordinates);

  return map.tiles
    .filter((tile) => tile.isRevealed)
    .filter((tile) => !tile.hexobject || coordinateKey(tile.coordinates) === enemyKey)
    .filter((tile) => hexDistance(tile.coordinates, heroCoordinates) > 1)
    .map((tile): EnemyMoveOption | null => {
      if (coordinateKey(tile.coordinates) === enemyKey) return null;

      const path = findShortestPath(map, enemyCoordinates, tile.coordinates, stepBudget);
      if (!path || path.length < 2) return null;

      return { coord: { ...tile.coordinates }, route: path.slice(1) };
    })
    .filter((option): option is EnemyMoveOption => !!option);
}

/**
 * Tiles around an enemy where it could plant its own defend marker.
 */
export function findAutoDefendCoords(
  map: HexMapModel,
  enemyCoordinates: IHexCoordinates,
): IHexCoordinates[] {
  return getOddQNeighbors(enemyCoordinates)
    .filter((coord) => {
      const coordKey = coordinateKey(coord);
      return map.tiles.some((tile) => coordinateKey(tile.coordinates) === coordKey);
    })
    .map((coord) => ({ ...coord }));
}
