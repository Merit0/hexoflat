import { deriveStream } from '../../utils/random-seeded';
import {
  RecipeSchema,
  STAGE_NAMES,
  type BoardRecipe,
  type BoardRecipeInput,
  type StageName,
} from '../../content/boards/recipe-schema';
import type HexMapModel from '../../map/models/hex-map-model';
import { BoardCellMap } from '../board-cell-map';
import { attemptSeed } from '../board-seed';
import type { BoardDescriptor } from '../board-descriptors';
import { hashStaticDrawing } from '../drawing-hash';
import { assembleHexMapModel } from '../hex-map-assembly';
import { measureBoard, type BoardMeasurements } from '../measure-board';
import { VOID_CELL } from '../resolved-cell';
import { STAGE_REGISTRIES } from './registry';
import { BoardTrace } from './trace';
import type { BoardDraft, BoardRegion, CheckResult, RegionLink } from './types';

const MAX_ATTEMPTS = 12;

export interface RunBoardPipelineInput {
  seed: string;
  params?: Record<string, unknown>;
}

export interface PipelineBoard {
  map: HexMapModel;
  descriptor: BoardDescriptor;
  trace: BoardTrace;
  regions: BoardRegion[];
  links: RegionLink[];
  measures: BoardMeasurements | null;
}

type AttemptResult = { ok: true; draft: BoardDraft } | { ok: false; reason: string };

function runStage(
  stage: StageName,
  recipe: BoardRecipe,
  draft: BoardDraft,
  attemptSeedValue: string,
  params: Record<string, unknown>,
): CheckResult {
  for (const pieceParams of recipe.stages[stage]) {
    const piece = STAGE_REGISTRIES[stage][pieceParams.kind];
    if (!piece) throw new Error(`recipe "${recipe.id}": no ${stage} piece "${pieceParams.kind}"`);
    const parsed = piece.schema.parse(pieceParams);
    const rng = deriveStream(attemptSeedValue, `${stage}:${pieceParams.kind}`);
    const result = piece.run(draft, parsed, { recipe, seed: attemptSeedValue, params, rng });
    if (stage === 'checks' && !(result as CheckResult).ok) return result as CheckResult;
  }
  return { ok: true };
}

function runAttempt(
  recipe: BoardRecipe,
  attemptSeedValue: string,
  params: Record<string, unknown>,
): AttemptResult {
  const draft: BoardDraft = {
    frame: recipe.frame,
    background: recipe.background,
    entryObject: recipe.entryObject,
    cellMap: new BoardCellMap(),
    regions: [],
    links: [],
    trace: new BoardTrace(),
  };

  for (const stage of STAGE_NAMES) {
    const result = runStage(stage, recipe, draft, attemptSeedValue, params);
    if (!result.ok) return result;
  }
  return { ok: true, draft };
}

function describeBoard(
  recipe: BoardRecipe,
  draft: BoardDraft,
  seed: string,
  attempt: number,
  params: Record<string, unknown>,
): BoardDescriptor {
  if (recipe.kind === 'static') {
    return {
      kind: 'STATIC',
      id: recipe.id,
      drawingHash: draft.drawing ? hashStaticDrawing(draft.drawing) : undefined,
    };
  }
  return { kind: 'RECIPE', recipeId: recipe.id, version: recipe.version, seed, params, attempt };
}

function finalize(
  recipe: BoardRecipe,
  draft: BoardDraft,
  seed: string,
  attempt: number,
  params: Record<string, unknown>,
): PipelineBoard {
  const map = assembleHexMapModel({
    boardColumns: recipe.frame.columns,
    boardRows: recipe.frame.rows,
    background: recipe.background,
    fogPolicy: recipe.fog === 'ALL_REVEALED' ? 'ALL_REVEALED' : 'FOG',
    cellAt: (coord) => draft.cellMap.get(coord) ?? VOID_CELL,
  });

  return {
    map,
    descriptor: describeBoard(recipe, draft, seed, attempt, params),
    trace: draft.trace,
    regions: draft.regions,
    links: draft.links,
    measures: recipe.entryObject ? measureBoard(map, recipe.entryObject) : null,
  };
}

export function runBoardPipeline(
  recipeInput: BoardRecipeInput,
  input: RunBoardPipelineInput,
): PipelineBoard {
  const recipe = RecipeSchema.parse(recipeInput);
  const params = input.params ?? {};
  const attempts = recipe.kind === 'static' ? 1 : MAX_ATTEMPTS;
  let lastReason = '';

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = runAttempt(recipe, attemptSeed(input.seed, attempt), params);
    if (result.ok) return finalize(recipe, result.draft, input.seed, attempt, params);
    lastReason = result.reason;
  }

  if (recipe.fallbackSeed !== undefined) {
    const result = runAttempt(recipe, recipe.fallbackSeed, params);
    if (result.ok) return finalize(recipe, result.draft, input.seed, attempts, params);
    lastReason = result.reason;
  }

  throw new Error(`recipe "${recipe.id}": every attempt failed (${lastReason})`);
}
