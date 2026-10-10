import type { BoardLayout } from '../schemas';

export const BASIN_01_LAYOUT = {
  id: 'basin-01',
  zones: [
    { id: 'A', col: 0, row: 2, width: 7, height: 7 },
    { id: 'B', col: 0, row: 10, width: 7, height: 7 },
    { id: 'C', col: 11, row: 10, width: 7, height: 7 },
  ],
  links: [
    { from: 'A', fromEdge: 'S', to: 'B', toEdge: 'N' },
    { from: 'B', fromEdge: 'E', to: 'C', toEdge: 'W' },
  ],
  entryZone: 'A',
  depth: { A: 0, B: 1, C: 2 },
} satisfies BoardLayout;
