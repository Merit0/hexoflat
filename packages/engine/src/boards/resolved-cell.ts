import type { THexobjectKey } from '../registry/hexobjects-registry';

/** One cell of an assembled board, before it becomes a HexMapModel tile. `exists: false` means void — no tile at all. A wall is just a GROUND cell whose hexobject happens to be STONE_WALL, not a separate kind. */
export interface ResolvedCell {
  exists: boolean;
  hexobject?: { hexobjectKey: THexobjectKey; overrides?: Record<string, unknown> };
}

export const VOID_CELL: ResolvedCell = { exists: false };
export const GROUND_CELL: ResolvedCell = { exists: true };
