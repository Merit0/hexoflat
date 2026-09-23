import type { BoardChunk } from '../schemas';
import { CAVE_ENTRY_FORK_CHUNK } from './cave/cave-entry-fork';
import { CAVE_HALL_A_CHUNK } from './cave/cave-hall-a';
import { CAVE_HALL_B_CHUNK } from './cave/cave-hall-b';
import { CAVE_ENTRY_BASIN_CHUNK } from './cave/cave-entry-basin';
import { CAVE_JUNCTION_CHUNK } from './cave/cave-junction';
import { CAVE_DEADEND_CHUNK } from './cave/cave-deadend';

export const BOARD_CHUNKS: BoardChunk[] = [
  CAVE_ENTRY_FORK_CHUNK,
  CAVE_HALL_A_CHUNK,
  CAVE_HALL_B_CHUNK,
  CAVE_ENTRY_BASIN_CHUNK,
  CAVE_JUNCTION_CHUNK,
  CAVE_DEADEND_CHUNK,
];
