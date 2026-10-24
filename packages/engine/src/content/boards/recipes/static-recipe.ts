import type { THexobjectKey } from '../../../registry/hexobjects-registry';
import { BOARD_COLUMNS, BOARD_ROWS } from '../../../boards/board-size';
import type { BoardRecipeInput } from '../recipe-schema';
import type { StaticBoardDrawing } from '../schemas';

export function staticRecipe(
  drawing: StaticBoardDrawing,
  options: { fog: 'FOG' | 'ALL_REVEALED'; entryObject: THexobjectKey },
): BoardRecipeInput {
  return {
    id: drawing.id,
    version: 1,
    kind: 'static',
    frame: { columns: BOARD_COLUMNS, rows: BOARD_ROWS },
    background: drawing.background,
    fog: options.fog,
    entryObject: options.entryObject,
    stages: {
      form: [{ kind: 'drawing', drawing }],
      gates: [{ kind: 'drawing' }],
      objects: [{ kind: 'drawing' }],
      bounds: [{ kind: 'void' }],
    },
  };
}
