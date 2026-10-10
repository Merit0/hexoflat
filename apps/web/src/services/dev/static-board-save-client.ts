import type { StaticBoardDrawing } from '@hexoflat/engine/content/boards/schemas';
import { STATIC_BOARD_SAVE_ENDPOINT } from './static-board-save-endpoint';

export interface StaticBoardSaveResponse {
  ok: boolean;
  reason?: string;
}

export async function saveStaticBoardDrawing(
  drawing: StaticBoardDrawing,
): Promise<StaticBoardSaveResponse> {
  const response = await fetch(STATIC_BOARD_SAVE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(drawing),
  });

  return (await response.json()) as StaticBoardSaveResponse;
}
