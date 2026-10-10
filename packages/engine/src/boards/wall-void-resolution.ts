import { getHexNeighbors } from '../utils/hex-utils';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { parseCoordinateKey, type BoardCellMap } from './board-cell-map';
import type { ResolvedCell } from './resolved-cell';

function isWall(cell: ResolvedCell | undefined): boolean {
  return !!cell?.exists && cell.hexobject?.hexobjectKey === HEXOBJECT_KEYS.STONE_WALL;
}

function isGroundLike(cell: ResolvedCell | undefined): boolean {
  return !!cell?.exists && !isWall(cell);
}

/** §3.4 step 7: a wall cell with no passable (ground) neighbour anywhere on the board is outside the playable space and becomes void instead of a floating wall tile. */
export function resolveDeepWallsToVoid(cellMap: BoardCellMap): void {
  const toClear: string[] = [];

  for (const [key, cell] of cellMap.entries()) {
    if (!isWall(cell)) continue;

    const hasGroundNeighbour = getHexNeighbors(parseCoordinateKey(key)).some((neighbor) =>
      isGroundLike(cellMap.get(neighbor)),
    );
    if (!hasGroundNeighbour) toClear.push(key);
  }

  for (const key of toClear) cellMap.delete(parseCoordinateKey(key));
}
