import type { StaticBoardDrawing } from '../schemas';

export const SILESIA_BOARD = {
  id: 'silesia',
  background: '/hex-assets/board-hexes/grass-hex.png',
  legend: {
    A: { hexobjectKey: 'tree', overrides: { regrowMs: 25000 } },
    C: { hexobjectKey: 'camping-entrance' },
    H: { hexobjectKey: 'health-bottle' },
    M: { hexobjectKey: 'mana-bottle' },
    N: { hexobjectKey: 'energy-bottle' },
    R: { hexobjectKey: 'rock' },
    V: { hexobjectKey: 'cave-entrance' },
  },
  // 0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17
  rows: [
    '. . . . . . . . . . . . . . . . . ~', // r00
    ' . . . . . . . . . . . . . . . . . ~', // r01
    '. . . . . . . . . . . . . . . . . ~', // r02
    ' . . . . . . . . . . . . . . . . . ~', // r03
    '. . . . . . . . . . . . . . . . . ~', // r04
    ' . H . . . . M . . N . . . R V R . ~', // r05
    '. . . . . . . . . . . . . . R R . ~', // r06
    ' . . . . . . . . . . . . . . . . . ~', // r07
    '. . . . . . . . . . . . . . . . . ~', // r08
    ' . . . . . . A A . . . . . . . . . ~', // r09
    '. . . . C . A A . . . . . . . . . ~', // r10
    ' . . . . . . . . . . . . . . . . . ~', // r11
    '. . . . . . . . . . . . . . . . . ~', // r12
    ' . . . . . . . . . . . . . . . . . ~', // r13
    '. . . . . . . . . . . . . . . . . ~', // r14
    ' ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~', // r15
    '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~', // r16
  ],
} satisfies StaticBoardDrawing;
