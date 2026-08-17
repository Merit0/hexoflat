import type HexMapModel from '../map/models/hex-map-model';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { EHexCollision } from '../abstraction/hexobject-abstraction';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { coordinateKey } from '../utils/hex-utils';
import { getReachableTileDistances } from './reachable-range-service';
import { findShortestPath } from './pathfinding-service';

/**
 * Whether a hero may end a move on a tile, and how it would get there.
 *
 * These are rules, so they live in the engine: the same question has to be
 * answerable by the server when it validates a co-op client's move, and by a
 * replay reconstructing a past turn. The store above keeps only the parts
 * that are genuinely presentation — the step animation and the bookkeeping
 * that follows each step.
 */

/**
 * A tile is enterable when it exists, the hero can see it, nothing solid
 * occupies it, and it is not the camp entrance (which is a transition
 * trigger rather than somewhere to stand).
 */
export function isEnterableTile(map: HexMapModel, target: IHexCoordinates): boolean {
  const tile = map.getTileAt(target);

  if (!tile || !tile.isRevealed) return false;
  if (tile.hexobject?.collision === EHexCollision.SOLID) return false;

  return tile.hexobject?.hexobjectKey !== HEXOBJECT_KEYS.CAMPING_ENTRANCE;
}

/**
 * Plans a move during combat, where the hero has a hard step budget instead
 * of the free-roam movement the MOVE_HERO command handles.
 *
 * Returns the route *excluding* the hero's current tile, or null when the
 * target is out of budget or unreachable. Returning the route rather than
 * applying it keeps this callable for validation alone.
 */
export function planCombatRoute(
  map: HexMapModel,
  from: IHexCoordinates,
  target: IHexCoordinates,
  moveSteps: number,
): IHexCoordinates[] | null {
  if (moveSteps <= 0) return null;
  if (!getReachableTileDistances(map, from, moveSteps).has(coordinateKey(target))) return null;

  const path = findShortestPath(map, from, target, moveSteps);
  if (!path || path.length < 2) return null;

  return path.slice(1);
}
