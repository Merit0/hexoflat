import type { ZodType } from 'zod';
import type { THexobjectKey } from '../../registry/hexobjects-registry';
import type { IHexCoordinates } from '../../map/interfaces/hex-tile-config-interface';
import type { SeededRandom } from '../../utils/random-seeded';
import type { StaticBoardDrawing } from '../../content/boards/schemas';
import type { BoardRecipe } from '../../content/boards/recipe-schema';
import type { BoardCellMap } from '../board-cell-map';
import type { BoardTrace } from './trace';

export interface BoardRegion {
  id: string;
  role: string;
  cells: IHexCoordinates[];
}

export interface BoardDraft {
  frame: { columns: number; rows: number };
  background: string;
  entryObject?: THexobjectKey;
  cellMap: BoardCellMap;
  regions: BoardRegion[];
  trace: BoardTrace;
  drawing?: StaticBoardDrawing;
}

export interface PieceContext {
  recipe: BoardRecipe;
  seed: string;
  params: Record<string, unknown>;
  rng: SeededRandom;
}

export type CheckResult = { ok: true } | { ok: false; reason: string };

export interface Piece<TParams, TResult = void> {
  id: string;
  schema: ZodType<TParams>;
  tableRule: string;
  run(draft: BoardDraft, params: TParams, ctx: PieceContext): TResult;
}
