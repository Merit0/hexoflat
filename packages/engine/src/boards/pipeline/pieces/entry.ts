import { z } from 'zod';
import type { IHexCoordinates } from '../../../map/interfaces/hex-tile-config-interface';
import { isWalkableFloor } from '../../resolved-cell';
import { getHexNeighbors } from '../../../utils/hex-utils';
import type { Piece } from '../types';

const EntryParams = z.object({ kind: z.literal('entry') });

export const gatesEntry: Piece<z.infer<typeof EntryParams>> = {
  id: 'entry',
  schema: EntryParams,
  tableRule:
    'Put the way in on an inner floor tile of the entry room, never against a wall, so the party always has room to step away from it.',
  run(draft, _params, ctx) {
    const objectKey = draft.entryObject;
    if (!objectKey) throw new Error('GATES:entry needs recipe.entryObject');
    const region = draft.regions.find((candidate) => candidate.role === 'entry');
    if (!region) throw new Error('GATES:entry needs a region with the entry role');

    const isFloor = (coord: IHexCoordinates) => isWalkableFloor(draft.cellMap.get(coord));
    const inner = region.cells.filter((cell) => getHexNeighbors(cell).every(isFloor));
    const cell = inner[Math.floor(ctx.rng() * inner.length)];
    if (!cell) throw new Error(`entry region "${region.id}" has no inner tile`);

    draft.cellMap.set(cell, { exists: true, hexobject: { hexobjectKey: objectKey } });
    draft.trace.record(cell, { stage: 'gates', pieceId: 'entry', note: objectKey });
  },
};
