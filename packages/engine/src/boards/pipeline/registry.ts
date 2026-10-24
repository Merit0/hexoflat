import type { ZodType } from 'zod';
import type { StageName } from '../../content/boards/recipe-schema';
import { formDrawing, gatesDrawing, objectsDrawing } from './pieces/drawing';
import { boundsVoid, boundsWall } from './pieces/bounds';
import { checkReachable } from './pieces/checks';
import type { CheckResult, Piece } from './types';

export type PieceRegistry<TResult = void> = Record<string, Piece<unknown, TResult>>;

export const FORM: PieceRegistry = { drawing: formDrawing };
export const RELIEF: PieceRegistry = {};
export const BOUNDS: PieceRegistry = { void: boundsVoid, wall: boundsWall };
export const GATES: PieceRegistry = { drawing: gatesDrawing };
export const OBJECTS: PieceRegistry = { drawing: objectsDrawing };
export const CHECKS: PieceRegistry<CheckResult> = {
  reachable: checkReachable,
};

export const STAGE_REGISTRIES: Record<StageName, PieceRegistry<unknown>> = {
  form: FORM,
  relief: RELIEF,
  bounds: BOUNDS,
  gates: GATES,
  objects: OBJECTS,
  checks: CHECKS,
};

export interface RegisteredPiece {
  stage: StageName;
  id: string;
  schema: ZodType;
  tableRule: string;
}

export function listRegisteredPieces(): RegisteredPiece[] {
  return (Object.keys(STAGE_REGISTRIES) as StageName[]).flatMap((stage) =>
    Object.entries(STAGE_REGISTRIES[stage]).map(([id, piece]) => ({
      stage,
      id,
      schema: piece.schema,
      tableRule: piece.tableRule,
    })),
  );
}
