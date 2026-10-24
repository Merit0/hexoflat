import { RecipeSchema } from '@hexoflat/engine/content/boards/recipe-schema';
import { BOARD_MODELS } from '@hexoflat/engine/content/boards/models/index';
import { serializeBoardModel } from '@hexoflat/engine/boards/board-model-serializer';
import type { BoardRecipeInput } from '@hexoflat/engine/content/boards/recipe-schema';

export interface BoardModelSaveHandlerResult {
  status: number;
  body: { ok: boolean; reason?: string };
  fileName?: string;
  fileContent?: string;
}

function reject(status: number, reason: string): BoardModelSaveHandlerResult {
  return { status, body: { ok: false, reason } };
}

export function handleBoardModelSaveRequest(rawBody: string): BoardModelSaveHandlerResult {
  let candidate: unknown;
  try {
    candidate = JSON.parse(rawBody);
  } catch {
    return reject(400, 'request body is not valid JSON');
  }

  const parsed = RecipeSchema.safeParse(candidate);
  if (!parsed.success) return reject(400, parsed.error.message);

  const recipe = candidate as BoardRecipeInput;
  if (recipe.kind !== 'generated') return reject(400, 'only generated models can be saved');
  if (!Object.hasOwn(BOARD_MODELS, recipe.id)) {
    return reject(400, `unknown model id "${recipe.id}"`);
  }

  return {
    status: 200,
    body: { ok: true },
    fileName: `${recipe.id}.ts`,
    fileContent: serializeBoardModel(recipe),
  };
}
