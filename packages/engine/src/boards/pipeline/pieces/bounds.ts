import { z } from 'zod';
import type { IHexCoordinates } from '../../../map/interfaces/hex-tile-config-interface';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../../../registry/hexobjects-registry';
import { hexobjectKeySchema } from '../../../content/content-schema';
import { getHexNeighbors } from '../../../utils/hex-utils';
import { parseCoordinateKey } from '../../board-cell-map';
import { resolveDeepWallsToVoid } from '../../wall-void-resolution';
import type { BoardDraft, Piece } from '../types';
import { inFrame } from '../piece-utils';

const VoidParams = z.object({ kind: z.literal('void') });
const WallParams = z.object({
  kind: z.literal('wall'),
  enclose: z.boolean().default(false),
  hexobject: hexobjectKeySchema.default(HEXOBJECT_KEYS.STONE_WALL),
});

export const boundsVoid: Piece<z.infer<typeof VoidParams>> = {
  id: 'void',
  schema: VoidParams,
  tableRule: 'The board simply ends where the land ends.',
  run() {},
};

function encloseGroundWithWalls(draft: BoardDraft, hexobjectKey: THexobjectKey): void {
  const toWall: IHexCoordinates[] = [];
  for (const [key, cell] of draft.cellMap.entries()) {
    if (!cell.exists || cell.hexobject?.hexobjectKey === hexobjectKey) continue;
    for (const neighbor of getHexNeighbors(parseCoordinateKey(key))) {
      if (inFrame(draft, neighbor) && !draft.cellMap.has(neighbor)) toWall.push(neighbor);
    }
  }
  for (const coord of toWall) {
    draft.cellMap.set(coord, {
      exists: true,
      hexobject: { hexobjectKey },
    });
    draft.trace.record(coord, { stage: 'bounds', pieceId: 'wall', note: 'enclose' });
  }
}

export const boundsWall: Piece<z.infer<typeof WallParams>> = {
  id: 'wall',
  schema: WallParams,
  tableRule:
    'Walls stand only where they touch walkable floor; wall pieces with no floor beside them are taken off the table.',
  run(draft, params) {
    if (params.enclose) encloseGroundWithWalls(draft, params.hexobject);
    resolveDeepWallsToVoid(draft.cellMap);
  },
};
