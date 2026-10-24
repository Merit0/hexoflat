import { coordinateKey, getHexNeighbors } from '../utils/hex-utils';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { EHexCollision } from '../abstraction/hexobject-abstraction';
import { CONTENT } from '../content';
import type { BoardCellMap } from './board-cell-map';
import { isTerrainPassable } from './terrain';
import { getTags } from '../content/content-accessors';
import type { THexobjectKey } from '../registry/hexobjects-registry';

function isPassable(cellMap: BoardCellMap, coord: IHexCoordinates): boolean {
  const cell = cellMap.get(coord);
  if (!cell?.exists) return false;
  if (!isTerrainPassable(cell.terrain)) return false;
  if (!cell.hexobject) return true;
  return CONTENT[cell.hexobject.hexobjectKey]?.collision !== EHexCollision.SOLID;
}

function passableCellsReachableFrom(cellMap: BoardCellMap, start: IHexCoordinates): Set<string> {
  const reached = new Set<string>();
  const queue: IHexCoordinates[] = [start];

  while (queue.length) {
    const current = queue.shift() as IHexCoordinates;
    const key = coordinateKey(current);
    if (reached.has(key) || !isPassable(cellMap, current)) continue;
    reached.add(key);

    for (const neighbor of getHexNeighbors(current)) queue.push(neighbor);
  }

  return reached;
}

export type ReachabilityResult = { ok: true } | { ok: false; reason: string };

/** §3.4 step 9: BFS over the board's own cells (never findShortestPath — it requires isRevealed). A target counts as reached if any of its neighbours is in the reachable passable set. */
export function checkGeneratedBoardReachable(
  cellMap: BoardCellMap,
  entryCoord: IHexCoordinates,
  mustBeReachable: { coord: IHexCoordinates; label: string }[],
): ReachabilityResult {
  const entryNeighbour = getHexNeighbors(entryCoord).find((neighbor) =>
    isPassable(cellMap, neighbor),
  );
  if (!entryNeighbour)
    return { ok: false, reason: 'entry object has no passable neighbour to start from' };

  const reached = passableCellsReachableFrom(cellMap, entryNeighbour);

  for (const target of mustBeReachable) {
    const hasReachedNeighbour = getHexNeighbors(target.coord).some((neighbor) =>
      reached.has(coordinateKey(neighbor)),
    );
    if (!hasReachedNeighbour) {
      return { ok: false, reason: `"${target.label}" has no reachable passable neighbour` };
    }
  }

  return { ok: true };
}

export function mustBeReachable(key: THexobjectKey): boolean {
  return !getTags(key).includes('barrier');
}
