import type { StaticBoardDrawing } from '../schemas';

export const SILESIA_NORTH_BOARD = {
  id: 'silesia-north',
  background: '/hex-assets/board-hexes/grass-hex.png',
  legend: {
    A: { hexobjectKey: 'tree', overrides: { regrowMs: 25000 } },
    K: { hexobjectKey: 'mountain' },
    M: { hexobjectKey: 'mana-bottle' },
    R: { hexobjectKey: 'rock' },
  },
  // 0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17
  rows: [
    '^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^', // r00
    ' ^ K K K K K K K K K K K K K K K K ^', // r01
    '^ K K K K K K K K K K K K K K K K ^', // r02
    ' ^ K K K K K K K K K K K K K K K K ^', // r03
    '^ K K . . K K K K . . . K K K K K ^', // r04
    ' ^ K . . . . . . . . . . . K K K K ^', // r05
    '^ K . . A A . . . . . . . . K K K ^', // r06
    ' ^ . . . A A . . . . . R . . . K K ^', // r07
    '^ . . . . . . . . . . . . . . . K ^', // r08
    ' ^ . . . . . . M . . . . . . . . K ^', // r09
    '^ K . . . . . . . . . . . . . K K ^', // r10
    ' ^ K . . . . . . . . . . R . . K K ^', // r11
    '^ K K . . . . . . . . . . . K K K ^', // r12
    ' ^ K K K . . . . . . . . . K K K K ^', // r13
    '^ K K K K . . . . . . . K K K K K ^', // r14
    ' ^ K K K K K . . . . . K K K K K K ^', // r15
    '^ ^ ^ ^ ^ ^ ^ ^ > ^ ^ ^ ^ ^ ^ ^ ^ ^', // r16
  ],
} satisfies StaticBoardDrawing;
