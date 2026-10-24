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
    '~ = = = ^ ^ ^ ^ > ^ ^ ^ ^ ^ ^ ^ ^ ~', // r00
    ' = = = = K K K . . K K ^ ^ ^ ^ ^ ^ ^', // r01
    '= = = . . K . . . . R K K = ^ ^ ^ ^', // r02
    ' = = = . . . . . . . V . K = = ^ ^ ^', // r03
    '= = . . . . . . . . . . R K K K ^ ^', // r04
    ' = = = . . A . H . C . . . . A K ^ ^', // r05
    '= = = = . A A . . . . . . A A K K ^', // r06
    ' = = = = . . A . . . . . . . A A K ^', // r07
    '= = = . . . . . . . . . R . M A K ^', // r08
    ' = = . . . A A A . . A A A . . A K ^', // r09
    '= = . . A A A A . A A K A A . A K ^', // r10
    ' = = = . A A A A . . A K K A . A K ^', // r11
    '= = = . . A A . N . A A A . . A K ^', // r12
    ' = = = = . A A . . . . A A A . A ^ ^', // r13
    '= = = = . . A A A A . A A A A A ^ ^', // r14
    ' = = = = = . . A A A A A A A ^ ^ ^ ^', // r15
    '~ = = = = = ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ~', // r16
  ],
} satisfies StaticBoardDrawing;
