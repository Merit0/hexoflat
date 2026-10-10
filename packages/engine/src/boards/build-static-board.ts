import type HexMapModel from '../map/models/hex-map-model';
import type { TFogPolicy } from '../map/models/hex-map-model';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import type { StaticBoardDrawing } from '../content/boards/schemas';
import type { StaticBoardDescriptor } from './board-descriptors';
import { BOARD_COLUMNS, BOARD_ROWS } from './board-size';
import { parseBoardRows } from './board-rows';
import { assembleHexMapModel } from './hex-map-assembly';
import { GROUND_CELL, VOID_CELL, type ResolvedCell } from './resolved-cell';
import { hashStaticDrawing } from './drawing-hash';

const VOID_SYMBOL = '~';
const GROUND_SYMBOL = '.';
const WALL_SYMBOL = '#';

export function resolveStaticDrawingCell(
  drawing: StaticBoardDrawing,
  grid: string[][],
  coordinates: IHexCoordinates,
): ResolvedCell {
  const symbol = grid[coordinates.rowIndex]?.[coordinates.columnIndex];
  if (symbol === undefined || symbol === VOID_SYMBOL) return VOID_CELL;
  if (symbol === GROUND_SYMBOL) return GROUND_CELL;
  if (symbol === WALL_SYMBOL) {
    return { exists: true, hexobject: { hexobjectKey: HEXOBJECT_KEYS.STONE_WALL } };
  }

  const legendEntry = drawing.legend[symbol];
  if (!legendEntry) {
    throw new Error(`static drawing "${drawing.id}": no legend entry for symbol "${symbol}"`);
  }
  return { exists: true, hexobject: legendEntry };
}

export interface BuiltStaticBoard {
  map: HexMapModel;
  descriptor: StaticBoardDescriptor;
}

export function buildStaticBoard(
  drawing: StaticBoardDrawing,
  fogPolicy?: TFogPolicy,
): BuiltStaticBoard {
  const grid = parseBoardRows(drawing.rows);

  const map = assembleHexMapModel({
    boardColumns: BOARD_COLUMNS,
    boardRows: BOARD_ROWS,
    background: drawing.background,
    fogPolicy,
    cellAt: (coordinates) => resolveStaticDrawingCell(drawing, grid, coordinates),
  });

  return {
    map,
    descriptor: { kind: 'STATIC', id: drawing.id, drawingHash: hashStaticDrawing(drawing) },
  };
}
