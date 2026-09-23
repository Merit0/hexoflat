import type { BoardChunk } from '../../schemas';

/** Entry hall with one south door — fits basin-01's zone A (links south to B). */
export const CAVE_ENTRY_BASIN_CHUNK = {
  id: 'cave-entry-basin-01',
  biome: 'CAVE',
  rows: [
    '# # # # # # #',
    ' # . . . . . #',
    '# . . T . . #',
    ' # . . . . . #',
    '# . . P . . #',
    ' # . . . . . #',
    '# # D # X # #',
  ],
} satisfies BoardChunk;
