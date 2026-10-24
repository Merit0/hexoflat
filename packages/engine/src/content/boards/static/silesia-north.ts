import type { StaticBoardDrawing } from '../schemas';

export const SILESIA_NORTH_BOARD = {
  id: 'silesia-north',
  background: '/hex-assets/board-hexes/grass-hex.png',
  legend: {
    A: { hexobjectKey: 'tree', overrides: { regrowMs: 25000 } },
    M: { hexobjectKey: 'mana-bottle' },
    R: { hexobjectKey: 'rock' },
  },
  // 0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17
  rows: [
    '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~', // r00
    ' ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~', // r01
    '~ ~ ~ ~ ~ ~ ^ ^ ^ ^ ^ ~ ~ ~ ~ ~ ~ ~', // r02
    ' ~ ~ ~ ~ ^ ^ ^ ^ ^ ^ ^ ^ ~ ~ ~ ~ ~ ~', // r03
    '~ ~ ~ . . ^ ^ ^ ^ . . . ~ ~ ~ ~ ~ ~', // r04
    ' ~ ~ . . . . . . . . . . . ~ ~ ~ ~ ~', // r05
    '~ ~ . . A A . . . . . . . . ~ ~ ~ ~', // r06
    ' ~ . . . A A . . . . . R . . . ~ ~ ~', // r07
    '~ . . . . . . . . . . . . . . . ~ ~', // r08
    ' ~ . . . . . . M . . . . . . . . ~ ~', // r09
    '~ ~ . . . . . . . . . . . . . ~ ~ ~', // r10
    ' ~ ~ . . . . . . . . . . R . . ~ ~ ~', // r11
    '~ ~ ~ . . . . . . . . . . . ~ ~ ~ ~', // r12
    ' ~ ~ ~ ~ . . . . . . . . . ~ ~ ~ ~ ~', // r13
    '~ ~ ~ ~ ~ . . . . . . . ~ ~ ~ ~ ~ ~', // r14
    ' ~ ~ ~ ~ ~ ~ . . . . . ~ ~ ~ ~ ~ ~ ~', // r15
    '~ ~ ~ ~ ~ ~ ~ ~ > ~ ~ ~ ~ ~ ~ ~ ~ ~', // r16
  ],
} satisfies StaticBoardDrawing;
