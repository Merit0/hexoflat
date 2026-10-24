import type { BoardRecipeInput } from '@hexoflat/engine/content/boards/recipe-schema';
import { BOARD_MODEL_SAVE_ENDPOINT } from './board-model-save-endpoint';

export interface BoardModelSaveResponse {
  ok: boolean;
  reason?: string;
}

export async function saveBoardModel(recipe: BoardRecipeInput): Promise<BoardModelSaveResponse> {
  const response = await fetch(BOARD_MODEL_SAVE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(recipe),
  });

  return (await response.json()) as BoardModelSaveResponse;
}
