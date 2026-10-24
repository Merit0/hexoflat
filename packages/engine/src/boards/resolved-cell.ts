import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';
import type { ExitSide } from './exits';
import { isTerrainPassable, type TerrainId } from './terrain';

/** One cell of an assembled board, before it becomes a HexMapModel tile. `exists: false` means void — no tile at all. A wall is just a GROUND cell whose hexobject happens to be STONE_WALL, not a separate kind. */
export interface ResolvedCell {
  exists: boolean;
  terrain?: TerrainId;
  exit?: ExitSide;
  hexobject?: { hexobjectKey: THexobjectKey; overrides?: Record<string, unknown> };
}

export const VOID_CELL: ResolvedCell = { exists: false };
export const GROUND_CELL: ResolvedCell = { exists: true };

export function isWalkableFloor(cell: ResolvedCell | undefined): boolean {
  return (
    !!cell?.exists &&
    cell.hexobject?.hexobjectKey !== HEXOBJECT_KEYS.STONE_WALL &&
    isTerrainPassable(cell.terrain)
  );
}
