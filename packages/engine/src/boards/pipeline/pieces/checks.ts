import { z } from 'zod';
import type { IHexCoordinates } from '../../../map/interfaces/hex-tile-config-interface';
import { parseCoordinateKey } from '../../board-cell-map';
import { checkGeneratedBoardReachable } from '../../board-reachability';
import { isWalkableFloor } from '../../resolved-cell';
import { coordinateKey, getHexNeighbors } from '../../../utils/hex-utils';
import type { BoardDraft, BoardRegion, CheckResult, Piece } from '../types';

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

const ShapeParams = z.object({
  kind: z.literal('shape'),
  minRegions: z.number().int().min(1).default(1),
  minRegionHexes: z.number().int().min(1).default(19),
});

function isFloor(draft: BoardDraft, coord: IHexCoordinates): boolean {
  return isWalkableFloor(draft.cellMap.get(coord));
}

function floorComponentCount(draft: BoardDraft): number {
  const seen = new Set<string>();
  let components = 0;
  for (const [key, cell] of draft.cellMap.entries()) {
    const start = parseCoordinateKey(key);
    if (!cell.exists || seen.has(key) || !isFloor(draft, start)) continue;
    components += 1;
    const stack = [start];
    while (stack.length) {
      const current = stack.pop() as IHexCoordinates;
      const currentKey = coordinateKey(current);
      if (seen.has(currentKey) || !isFloor(draft, current)) continue;
      seen.add(currentKey);
      stack.push(...getHexNeighbors(current));
    }
  }
  return components;
}

function touchesFloorOf(draft: BoardDraft, region: BoardRegion, other: BoardRegion): boolean {
  const otherKeys = new Set(other.cells.map(coordinateKey));
  return region.cells.some((cell) =>
    getHexNeighbors(cell).some((neighbor) => otherKeys.has(coordinateKey(neighbor))),
  );
}

function linked(draft: BoardDraft, a: BoardRegion, b: BoardRegion): boolean {
  return draft.links.some(
    (link) => (link.from === a.id && link.to === b.id) || (link.from === b.id && link.to === a.id),
  );
}

function isFrameCornerClear(draft: BoardDraft): boolean {
  const { columns, rows } = draft.frame;
  return [
    { columnIndex: 0, rowIndex: 0 },
    { columnIndex: columns - 1, rowIndex: 0 },
    { columnIndex: 0, rowIndex: rows - 1 },
    { columnIndex: columns - 1, rowIndex: rows - 1 },
  ].every((corner) => !isFloor(draft, corner));
}

export const checkShape: Piece<z.infer<typeof ShapeParams>, CheckResult> = {
  id: 'shape',
  schema: ShapeParams,
  tableRule:
    'Count the rooms and their floor tiles; check the floor is one connected piece, rooms with no passage between them share only a wall, and the board is not a filled rectangle.',
  run(draft, params) {
    if (draft.regions.length < params.minRegions) {
      return { ok: false, reason: `only ${draft.regions.length} of ${params.minRegions} regions` };
    }
    const small = draft.regions.find(
      (region) =>
        region.cells.filter((cell) => isFloor(draft, cell)).length < params.minRegionHexes,
    );
    if (small)
      return { ok: false, reason: `region "${small.id}" is smaller than ${params.minRegionHexes}` };
    if (floorComponentCount(draft) !== 1)
      return { ok: false, reason: 'floor is not one connected area' };
    if (!isFrameCornerClear(draft)) return { ok: false, reason: 'a frame corner is floor' };

    for (const a of draft.regions) {
      for (const b of draft.regions) {
        if (a.id < b.id && !linked(draft, a, b) && touchesFloorOf(draft, a, b)) {
          return { ok: false, reason: `unlinked regions "${a.id}" and "${b.id}" touch` };
        }
      }
    }
    return { ok: true };
  },
};
