import { validateStaticBoardForSave } from '@hexoflat/engine/boards/validate-static-board-save';
import { serializeStaticBoardDrawing } from '@hexoflat/engine/boards/static-board-serializer';

const SAFE_ID_PATTERN = /^[a-z][a-z0-9-]*$/;

export interface StaticBoardSaveHandlerResult {
  status: number;
  body: { ok: boolean; reason?: string };
  fileName?: string;
  fileContent?: string;
}

export function handleStaticBoardSaveRequest(rawBody: string): StaticBoardSaveHandlerResult {
  let candidate: unknown;
  try {
    candidate = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { ok: false, reason: 'request body is not valid JSON' } };
  }

  const validated = validateStaticBoardForSave(candidate);
  if (!validated.ok) {
    return { status: 400, body: { ok: false, reason: validated.reason } };
  }

  if (!SAFE_ID_PATTERN.test(validated.drawing.id)) {
    return {
      status: 400,
      body: {
        ok: false,
        reason: `drawing id "${validated.drawing.id}" must be lowercase letters, digits and hyphens only`,
      },
    };
  }

  return {
    status: 200,
    body: { ok: true },
    fileName: `${validated.drawing.id}.ts`,
    fileContent: serializeStaticBoardDrawing(validated.drawing),
  };
}
