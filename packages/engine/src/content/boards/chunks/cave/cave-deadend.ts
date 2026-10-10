import type { BoardChunk } from '../../schemas';

/** One west door — fits basin-01's zone C (links west to B), a dead end. */
export const CAVE_DEADEND_CHUNK = {
  id: 'cave-deadend-01',
  biome: 'CAVE',
  rows: [
    '# # # # # # #',
    ' # . . . . . #',
    '# . . P . . #',
    ' D . . . . . #',
    '# . . T . . #',
    ' # . . . . . #',
    '# # # # # # #',
  ],
} satisfies BoardChunk;
