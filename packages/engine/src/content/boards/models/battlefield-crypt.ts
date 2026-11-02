import type { BoardRecipeInput } from '../recipe-schema';

export const BATTLEFIELD_CRYPT_MODEL = {
  id: 'battlefield-crypt',
  version: 1,
  kind: 'generated',
  frame: { columns: 13, rows: 11 },
  biome: 'CRYPT',
  background: '/hex-assets/board-hexes/stone-hex.png',
  fog: 'ALL_REVEALED',
  willZone: 'free',
  fallbackSeed: 'battlefield-crypt-fallback',
  stages: {
    form: [{ kind: 'hexagon', radius: 4, edgeNoise: [2, 4] }],
    bounds: [{ kind: 'wall', enclose: true, hexobject: 'stone-wall' }],
    relief: [
      { kind: 'battle-features', hazards: [1, 2], ledges: [0, 0], rubble: [0, 0], oil: [0, 0] },
    ],
    checks: [
      { kind: 'tactical-budget', hazards: [1, 2], minLedges: 0, cover: [0, 0], minCombos: 0 },
    ],
  },
} satisfies BoardRecipeInput;
