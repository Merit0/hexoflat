import { SILESIA_BOARD } from './static/silesia';
import { SILESIA_NORTH_BOARD } from './static/silesia-north';
import type { StaticBoardDrawing } from './schemas';

export const STATIC_DRAWINGS: StaticBoardDrawing[] = [SILESIA_BOARD, SILESIA_NORTH_BOARD];

export * from './schemas';
