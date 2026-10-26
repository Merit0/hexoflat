import type { StaticBoardDrawing } from '../schemas';

export const CAMPING_BOARD = {
  id: 'camping',
  background: '/hex-assets/board-hexes/stone-hex.png',
  legend: {
    A: { hexobjectKey: 'axe' },
    C: { hexobjectKey: 'coins' },
    D: { hexobjectKey: 'shield' },
    F: { hexobjectKey: 'fireplace' },
    G: { hexobjectKey: 'homeland-gate' },
    K: { hexobjectKey: 'pickaxe' },
    S: { hexobjectKey: 'sword' },
    T: { hexobjectKey: 'stash-chest' },
    W: { hexobjectKey: 'wood-and-leaves' },
  },
  // 0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17
  rows: [
    '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~', // r00
    ' ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~', // r01
    '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~', // r02
    ' ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~', // r03
    '~ ~ ~ ~ ~ ~ ~ G W W W W ~ ~ ~ ~ ~ ~', // r04
    ' ~ ~ ~ ~ ~ ~ W . . . . W ~ ~ ~ ~ ~ ~', // r05
    '~ ~ ~ ~ ~ ~ W . . . . S W ~ ~ ~ ~ ~', // r06
    ' ~ ~ ~ ~ ~ W . . C . . A W ~ ~ ~ ~ ~', // r07
    '~ ~ ~ ~ ~ W . . . F . D . W ~ ~ ~ ~', // r08
    ' ~ ~ ~ ~ ~ W . . T . K . W ~ ~ ~ ~ ~', // r09
    '~ ~ ~ ~ ~ ~ W . . . . . W ~ ~ ~ ~ ~', // r10
    ' ~ ~ ~ ~ ~ ~ W . . . . W ~ ~ ~ ~ ~ ~', // r11
    '~ ~ ~ ~ ~ ~ ~ W W W W W ~ ~ ~ ~ ~ ~', // r12
    ' ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~', // r13
    '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~', // r14
    ' ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~', // r15
    '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~', // r16
  ],
} satisfies StaticBoardDrawing;
