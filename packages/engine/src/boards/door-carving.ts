import { offsetToAxial, axialToOffset } from '../utils/hex-utils';
import { hexLineAxial } from '../utils/hex-line';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import type { BoardLayout } from '../content/boards/schemas';
import type { SeededRandom } from '../utils/random-seeded';
import type { BoardCellMap } from './board-cell-map';
import { GROUND_CELL } from './resolved-cell';
import type { ZonePlacement } from './zone-placement';

function carveDoorLine(cellMap: BoardCellMap, from: IHexCoordinates, to: IHexCoordinates): void {
  const line = hexLineAxial(offsetToAxial(from), offsetToAxial(to)).map(axialToOffset);
  for (const coord of line) cellMap.set(coord, GROUND_CELL);
}

function takeDoorCell(
  placement: ZonePlacement,
  edge: keyof ZonePlacement['doorCellsByEdge'],
): IHexCoordinates {
  const cells = placement.doorCellsByEdge[edge];
  const cell = cells?.shift();
  if (!cell) {
    throw new Error(`zone "${placement.zoneId}" has no unused door left on edge "${String(edge)}"`);
  }
  return cell;
}

/** Carves one passage per layout link between the two zones' chosen door cells — everywhere else stays walled by construction (only marked doors were ever opened). */
export function carveAllLinks(
  layout: BoardLayout,
  placementByZoneId: Map<string, ZonePlacement>,
  cellMap: BoardCellMap,
  rng: SeededRandom,
): void {
  for (const link of layout.links) {
    const fromPlacement = placementByZoneId.get(link.from);
    const toPlacement = placementByZoneId.get(link.to);
    if (!fromPlacement || !toPlacement) {
      throw new Error(`link references unknown zone "${link.from}" or "${link.to}"`);
    }

    shuffleDoorCells(fromPlacement.doorCellsByEdge[link.fromEdge], rng);
    shuffleDoorCells(toPlacement.doorCellsByEdge[link.toEdge], rng);

    const fromCell = takeDoorCell(fromPlacement, link.fromEdge);
    const toCell = takeDoorCell(toPlacement, link.toEdge);
    carveDoorLine(cellMap, fromCell, toCell);
  }
}

function shuffleDoorCells(cells: IHexCoordinates[] | undefined, rng: SeededRandom): void {
  if (!cells) return;
  for (let i = cells.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
}
