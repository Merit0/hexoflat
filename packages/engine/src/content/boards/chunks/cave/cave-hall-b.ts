import type { BoardChunk } from '../../schemas';

/** Alternate plain hall, one south door — gives fork-01's B/C zones a real choice of chunk. */
export const CAVE_HALL_B_CHUNK = {
  id: 'cave-hall-b',
  biome: 'CAVE',
  rows: [
    '# # # # # # #',
    ' # . . P . . #',
    '# . . . . . #',
    ' # . T . E . #',
    '# . . . . . #',
    ' # . . . . . #',
    '# # # D # # #',
  ],
} satisfies BoardChunk;
