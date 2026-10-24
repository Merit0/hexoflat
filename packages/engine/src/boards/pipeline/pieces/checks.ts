import { z } from 'zod';
import type { IHexCoordinates } from '../../../map/interfaces/hex-tile-config-interface';
import { parseCoordinateKey } from '../../board-cell-map';
import { checkGeneratedBoardReachable } from '../../board-reachability';
import type { CheckResult, Piece } from '../types';

const ReachableParams = z.object({ kind: z.literal('reachable') });

export const checkReachable: Piece<z.infer<typeof ReachableParams>, CheckResult> = {
  id: 'reachable',
  schema: ReachableParams,
  tableRule:
    'Walk from the entrance: every token must be touchable by someone standing on open floor.',
  run(draft) {
    const targets: { coord: IHexCoordinates; label: string }[] = [];
    let entryCoord: IHexCoordinates | undefined;

    for (const [key, cell] of draft.cellMap.entries()) {
      if (!cell.hexobject) continue;
      const coord = parseCoordinateKey(key);
      targets.push({ coord, label: cell.hexobject.hexobjectKey });
      if (!entryCoord && cell.hexobject.hexobjectKey === draft.entryObject) entryCoord = coord;
    }

    if (!entryCoord) return { ok: false, reason: 'board has no entry object to start from' };
    return checkGeneratedBoardReachable(draft.cellMap, entryCoord, targets);
  },
};
