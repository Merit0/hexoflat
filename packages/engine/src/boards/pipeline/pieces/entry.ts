import { z } from 'zod';
import type { IHexCoordinates } from '../../../map/interfaces/hex-tile-config-interface';
import { isWalkableFloor } from '../../resolved-cell';
import { HEXOBJECT_KEYS } from '../../../registry/hexobjects-registry';
import { coordinateKey, getHexNeighbors, hexDistance } from '../../../utils/hex-utils';
import { parseCoordinateKey } from '../../board-cell-map';
import type { Piece } from '../types';

const EntryParams = z.object({ kind: z.literal('entry') });

export const gatesEntry: Piece<z.infer<typeof EntryParams>> = {
  id: 'entry',
  schema: EntryParams,
  tableRule:
    'Put the way in on the outer wall of the entry room, as a part of the border of the board and never in the middle of it, so the party steps from it straight onto open floor.',
  run(draft, _params, ctx) {
    const objectKey = draft.entryObject;
    if (!objectKey) throw new Error('GATES:entry needs recipe.entryObject');
    const region = draft.regions.find((candidate) => candidate.role === 'entry');
    if (!region) throw new Error('GATES:entry needs a region with the entry role');

    const isFloor = (coord: IHexCoordinates) => isWalkableFloor(draft.cellMap.get(coord));
    const roomFloor = new Set(region.cells.filter(isFloor).map(coordinateKey));
    const middle = {
      columnIndex: Math.floor(draft.frame.columns / 2),
      rowIndex: Math.floor(draft.frame.rows / 2),
    };
    const walls = [...draft.cellMap.entries()]
      .filter(
        ([, cell]) => cell.exists && cell.hexobject?.hexobjectKey === HEXOBJECT_KEYS.STONE_WALL,
      )
      .map(([key]) => parseCoordinateKey(key))
      .filter((wall) => getHexNeighbors(wall).some((n) => roomFloor.has(coordinateKey(n))));
    const onTheEdge = walls.filter((wall) =>
      getHexNeighbors(wall).some((n) => !draft.cellMap.get(n)?.exists),
    );
    const pool = onTheEdge.length ? onTheEdge : walls;
    if (!pool.length) throw new Error(`entry region "${region.id}" has no outer wall`);

    const outermost = Math.max(...pool.map((wall) => hexDistance(wall, middle)));
    const rim = pool.filter((wall) => hexDistance(wall, middle) === outermost);
    const cell = rim[Math.floor(ctx.rng() * rim.length)];

    draft.cellMap.set(cell, {
      ...draft.cellMap.get(cell),
      exists: true,
      hexobject: { hexobjectKey: objectKey },
    });
    draft.trace.record(cell, { stage: 'gates', pieceId: 'entry', note: objectKey });
  },
};
