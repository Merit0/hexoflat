import type { StaticBoardDrawing } from '../schemas';

export const SILESIA_BOARD = {
  id: 'silesia',
  background: '/hex-assets/board-hexes/grass-hex.png',
  legend: {
    A: { hexobjectKey: 'tree', overrides: { regrowMs: 25000 } },
    C: { hexobjectKey: 'camping-entrance' },
    H: { hexobjectKey: 'health-bottle' },
    K: { hexobjectKey: 'mountain' },
    M: { hexobjectKey: 'mana-bottle' },
    N: { hexobjectKey: 'energy-bottle' },
    R: { hexobjectKey: 'rock' },
    V: { hexobjectKey: 'cave-entrance' },
  },
  // 0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17
  rows: [
    '~ ^ ^ ^ ~ ~ ^ ^ > ^ ^ ^ ^ ^ ~ ~ ^ ~', // r00
    ' ^ K K ^ ^ ^ K K . K K K K ^ ^ ^ ^ ^', // r01
    '~ ^ K K . R V R . . K K K K K K K ^', // r02
    ' ^ K . . . . . R . . . . K K K K K ^', // r03
    '^ . . . . . . . . . . . . . . K K ^', // r04
    ' ^ . . H . . . . . . = = . . . . K ^', // r05
    '^ . . . . . . . . . = = = . . . . ^', // r06
    ' ^ . . . . . C . . . . = . . M . . ^', // r07
    '^ . . A A . . . . . . . . R . . . ^', // r08
    ' ^ . . A A . . . . . . . . R . . K ^', // r09
    '^ K . . . . . . . . . . . . . . K ^', // r10
    ' ^ K . . . . . N . . . . . . . K K ^', // r11
    '^ K K . . . . . . . . . . . K K K ^', // r12
    ' ^ K K K . . . . . . . . K K K K ^ ~', // r13
    '^ K K K K . . . . . K K K K K K K ^', // r14
    ' ^ K K K K K K K K K K K K K K K ^ ~', // r15
    '~ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ~', // r16
  ],
} satisfies StaticBoardDrawing;
