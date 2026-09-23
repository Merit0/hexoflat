import type { StaticBoardDrawing } from '../schemas';

/**
 * 1:1 reproduction of HexMapProvider.getHomeLand() after its safe-zone
 * clearing (docs/WORLD-MAP-BOARDS-PLAN.md phase C1) — 17x15 ground inside
 * the 18x17 board frame, the rest void. Background matches the map's actual
 * terrain image (not the schema example's default placeholder).
 */
export const SILESIA_BOARD = {
  id: 'silesia',
  background: '/hex-assets/board-hexes/grass-hex.png',
  legend: {
    A: { hexobjectKey: 'tree', overrides: { regrowMs: 25000 } },
    R: { hexobjectKey: 'rock' },
    C: { hexobjectKey: 'camping-entrance' },
    V: { hexobjectKey: 'cave-entrance' },
    H: { hexobjectKey: 'health-bottle' },
    M: { hexobjectKey: 'mana-bottle' },
    N: { hexobjectKey: 'energy-bottle' },
  },
  //       0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17
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
