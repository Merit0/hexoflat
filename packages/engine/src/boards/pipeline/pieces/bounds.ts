import { z } from 'zod';
import { resolveDeepWallsToVoid } from '../../wall-void-resolution';
import type { Piece } from '../types';

const VoidParams = z.object({ kind: z.literal('void') });
const WallParams = z.object({ kind: z.literal('wall') });

export const boundsVoid: Piece<z.infer<typeof VoidParams>> = {
  id: 'void',
  schema: VoidParams,
  tableRule: 'The board simply ends where the land ends.',
  run() {},
};

export const boundsWall: Piece<z.infer<typeof WallParams>> = {
  id: 'wall',
  schema: WallParams,
  tableRule:
    'Walls stand only where they touch walkable floor; wall pieces with no floor beside them are taken off the table.',
  run(draft) {
    resolveDeepWallsToVoid(draft.cellMap);
  },
};
