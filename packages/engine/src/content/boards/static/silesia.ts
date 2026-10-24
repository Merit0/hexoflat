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
    '~ ~ ~ ~ ~ ~ ^ ^ ^ ^ ^ ^ ~ ~ ~ ~ ~ ~', // r00
    ' ~ ~ ~ ~ ^ ^ ^ ^ ^ ^ ^ ^ ^ ~ ~ ~ ~ ~', // r01
    '~ ~ ~ ^ . R V R . . ^ ^ ^ ~ ~ ~ ~ ~', // r02
    ' ~ ~ . . . . . R . . . . ^ ~ ~ ~ ~ ~', // r03
    '~ . . . . . . . . . . . . . . ~ ~ ~', // r04
    ' ~ . . H . . . . . . = = . . . . ~ ~', // r05
    '~ . . . . . . . . . = = = . . . . ~', // r06
    ' ~ . . . . . C . . . . = . . M . . ~', // r07
    '~ . . A A . . . . . . . . R . . . ~', // r08
    ' ~ . . A A . . . . . . . . R . . ~ ~', // r09
    '~ ~ . . . . . . . . . . . . . . ~ ~', // r10
    ' ~ ~ . . . . . N . . . . . . . ~ ~ ~', // r11
    '~ ~ ~ . . . . . . . . . . . ~ ~ ~ ~', // r12
    ' ~ ~ ~ ~ . . . . . . . . ~ ~ ~ ~ ~ ~', // r13
    '~ ~ ~ ~ ~ . . . . . ~ ~ ~ ~ ~ ~ ~ ~', // r14
    ' ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~', // r15
    '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~', // r16
  ],
} satisfies StaticBoardDrawing;
