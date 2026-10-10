import type { BoardLayout } from '../schemas';

export const FORK_01_LAYOUT = {
  id: 'fork-01',
  zones: [
    { id: 'A', col: 5, row: 10, width: 7, height: 7 },
    { id: 'B', col: 0, row: 2, width: 7, height: 7 },
    { id: 'C', col: 11, row: 2, width: 7, height: 7 },
  ],
  links: [
    { from: 'A', fromEdge: 'N', to: 'B', toEdge: 'S' },
    { from: 'A', fromEdge: 'N', to: 'C', toEdge: 'S' },
  ],
  entryZone: 'A',
  depth: { A: 0, B: 1, C: 1 },
} satisfies BoardLayout;
