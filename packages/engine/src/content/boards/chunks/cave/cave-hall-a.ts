import type { BoardChunk } from '../../schemas';

/** Plain hall, one south door — fits any 7x7 zone that only needs to link south. */
export const CAVE_HALL_A_CHUNK = {
  id: 'cave-hall-a',
  biome: 'CAVE',
  rows: [
    '# # # # # # #',
    ' # . . T . . #',
    '# . . . . . #',
    ' # . . . . . #',
    '# . . E . . #',
    ' # . . . . . #',
    '# # # D # # #',
  ],
} satisfies BoardChunk;
