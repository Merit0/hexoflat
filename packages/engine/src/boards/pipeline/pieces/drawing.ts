import { z } from 'zod';
import { CONTENT } from '../../../content';
import { StaticBoardDrawingSchema } from '../../../content/boards/schemas';
import { HEXOBJECT_KEYS } from '../../../registry/hexobjects-registry';
import { parseBoardRows } from '../../board-rows';
import { resolveStaticDrawingCell } from '../../build-static-board';
import { GROUND_CELL, VOID_CELL, type ResolvedCell } from '../../resolved-cell';
import { terrainFromSymbol } from '../../terrain';
import { classifyExits } from '../../exits';
import { parseCoordinateKey } from '../../board-cell-map';
import type { BoardDraft, Piece } from '../types';

const NO_PARAMS = z.object({ kind: z.string() });

const FormDrawingParams = z.object({
  kind: z.literal('drawing'),
  drawing: StaticBoardDrawingSchema,
});

const FORM_DRAWING_ID = 'drawing';
const NO_PARAMS_SCHEMA = NO_PARAMS;

function forEachFrameCell(
  draft: BoardDraft,
  visit: (coordinates: { columnIndex: number; rowIndex: number }) => void,
): void {
  for (let rowIndex = 0; rowIndex < draft.frame.rows; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < draft.frame.columns; columnIndex += 1) {
      visit({ columnIndex, rowIndex });
    }
  }
}

export const formDrawing: Piece<z.infer<typeof FormDrawingParams>> = {
  id: FORM_DRAWING_ID,
  schema: FormDrawingParams,
  tableRule:
    'Lay out the board exactly as drawn on the sheet: every marked cell is land, blank cells are void.',
  run(draft, params) {
    const { drawing } = params;
    const grid = parseBoardRows(drawing.rows);
    draft.drawing = drawing;

    forEachFrameCell(draft, (coordinates) => {
      const cell = resolveStaticDrawingCell(drawing, grid, coordinates);
      if (!cell.exists) {
        draft.cellMap.set(coordinates, VOID_CELL);
        return;
      }
      const isWall = cell.hexobject?.hexobjectKey === HEXOBJECT_KEYS.STONE_WALL;
      draft.cellMap.set(coordinates, isWall ? cell : GROUND_CELL);
      draft.trace.record(coordinates, {
        stage: 'form',
        pieceId: FORM_DRAWING_ID,
        note: isWall ? 'wall' : 'ground',
      });
    });
  },
};

function placeLegendObjects(
  draft: BoardDraft,
  stage: 'gates' | 'objects',
  pieceId: string,
  wantsGate: boolean,
): void {
  const { drawing } = draft;
  if (!drawing) throw new Error(`${stage}:${pieceId} needs a drawing from the form stage`);
  const grid = parseBoardRows(drawing.rows);

  forEachFrameCell(draft, (coordinates) => {
    const symbol = grid[coordinates.rowIndex]?.[coordinates.columnIndex];
    const entry = symbol === undefined ? undefined : drawing.legend[symbol];
    if (!entry) return;
    const isGate = CONTENT[entry.hexobjectKey]?.enter !== undefined;
    if (isGate !== wantsGate) return;

    const cell: ResolvedCell = { exists: true, hexobject: entry };
    draft.cellMap.set(coordinates, cell);
    draft.trace.record(coordinates, { stage, pieceId, note: entry.hexobjectKey });
  });
}

export const gatesDrawing: Piece<z.infer<typeof NO_PARAMS>> = {
  id: 'drawing',
  schema: NO_PARAMS,
  tableRule:
    'Put every doorway marked on the sheet (anything that leads to another place) in its cell first.',
  run(draft) {
    placeLegendObjects(draft, 'gates', 'drawing', true);
  },
};

export const objectsDrawing: Piece<z.infer<typeof NO_PARAMS>> = {
  id: 'drawing',
  schema: NO_PARAMS,
  tableRule: 'Put every other token marked on the sheet in its cell.',
  run(draft) {
    placeLegendObjects(draft, 'objects', 'drawing', false);
  },
};

export const reliefDrawing: Piece<z.infer<typeof NO_PARAMS>> = {
  id: 'drawing',
  schema: NO_PARAMS_SCHEMA,
  tableRule:
    'Colour the sheet as drawn: mountain and water marks are cells nobody can walk through, everything else stays open ground.',
  run(draft) {
    const { drawing } = draft;
    if (!drawing) throw new Error('relief:drawing needs a drawing from the form stage');
    const grid = parseBoardRows(drawing.rows);

    forEachFrameCell(draft, (coordinates) => {
      const symbol = grid[coordinates.rowIndex]?.[coordinates.columnIndex];
      const terrain = symbol === undefined ? null : terrainFromSymbol(symbol);
      if (!terrain || !draft.cellMap.has(coordinates)) return;

      draft.cellMap.set(coordinates, { exists: true, terrain });
      draft.trace.record(coordinates, { stage: 'relief', pieceId: 'drawing', note: terrain });
    });
  },
};

export const gatesExits: Piece<z.infer<typeof NO_PARAMS>> = {
  id: 'exits',
  schema: NO_PARAMS,
  tableRule:
    'Every arrow on the sheet is a path off the edge of the board; its side is the edge of the shape it sits nearest to. Standing on one at the end of a move carries you to the neighbouring board.',
  run(draft) {
    const { drawing } = draft;
    if (!drawing) throw new Error('gates:exits needs a drawing from the form stage');

    for (const [key, side] of classifyExits(parseBoardRows(drawing.rows))) {
      const coordinates = parseCoordinateKey(key);
      const existing = draft.cellMap.get(coordinates);
      draft.cellMap.set(coordinates, { ...(existing ?? GROUND_CELL), exit: side });
      draft.trace.record(coordinates, { stage: 'gates', pieceId: 'exits', note: `exit ${side}` });
    }
  },
};
