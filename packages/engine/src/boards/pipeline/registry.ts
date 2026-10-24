import type { ZodType } from 'zod';
import type { StageName } from '../../content/boards/recipe-schema';
import { formDrawing, gatesDrawing, objectsDrawing } from './pieces/drawing';
import { boundsVoid, boundsWall } from './pieces/bounds';
import { checkReachable, checkShape } from './pieces/checks';
import { formBlobs } from './pieces/blobs';
import { objectsRules } from './pieces/rules';
import { gatesEntry } from './pieces/entry';
import type { CheckResult, Piece } from './types';

export type PieceRegistry<TResult = void> = Record<string, Piece<unknown, TResult>>;

export const FORM: PieceRegistry = { drawing: formDrawing, blobs: formBlobs };
export const RELIEF: PieceRegistry = {};
export const BOUNDS: PieceRegistry = { void: boundsVoid, wall: boundsWall };
export const GATES: PieceRegistry = { drawing: gatesDrawing, entry: gatesEntry };
export const OBJECTS: PieceRegistry = { drawing: objectsDrawing, rules: objectsRules };
export const CHECKS: PieceRegistry<CheckResult> = {
  reachable: checkReachable,
  shape: checkShape,
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
