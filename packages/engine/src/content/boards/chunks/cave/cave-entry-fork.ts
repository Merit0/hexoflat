import type { BoardChunk } from '../../schemas';

/** Entry hall with two north doors — fits fork-01's zone A (forks toward B and C). */
export const CAVE_ENTRY_FORK_CHUNK = {
  id: 'cave-entry-fork-01',
  biome: 'CAVE',
  rows: [
    '# # D # D # #',
    ' # . . . . . #',
    '# . . T . . #',
    ' # . . . . . #',
    '# . . P . . #',
    ' # . . . . . #',
    '# # # X # # #',
  ],
} satisfies BoardChunk;
