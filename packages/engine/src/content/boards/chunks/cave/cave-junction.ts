import type { BoardChunk } from '../../schemas';

/** North and east doors — fits basin-01's zone B (links north to A, east to C). */
export const CAVE_JUNCTION_CHUNK = {
  id: 'cave-junction-01',
  biome: 'CAVE',
  rows: [
    '# # # D # # #',
    ' # . . . . . #',
    '# . . T . . #',
    ' # . . . E . D',
    '# . . . . . #',
    ' # . . P . . #',
    '# # # # # # #',
  ],
} satisfies BoardChunk;
