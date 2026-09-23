import { SILESIA_BOARD } from './static/silesia';
import type { StaticBoardDrawing } from './schemas';

export const STATIC_DRAWINGS: StaticBoardDrawing[] = [SILESIA_BOARD];

export { BOARD_CHUNKS } from './chunks';
export { BOARD_LAYOUTS } from './layouts';
export { BOARD_PRESETS } from './presets';
export * from './schemas';
