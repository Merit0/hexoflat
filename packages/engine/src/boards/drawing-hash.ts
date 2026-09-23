import { sha256Hex } from '../utils/hash/sha256';
import type { StaticBoardDrawing } from '../content/boards/schemas';

export function hashStaticDrawing(drawing: StaticBoardDrawing): string {
  return sha256Hex(JSON.stringify(drawing));
}
