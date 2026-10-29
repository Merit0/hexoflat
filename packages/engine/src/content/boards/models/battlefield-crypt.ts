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
      { kind: 'battle-features', hazards: [1, 2], ledges: [2, 3], rubble: [2, 4], oil: [1, 1] },
    ],
    objects: [{ kind: 'battle-cover', cover: [2, 4] }],
    checks: [{ kind: 'tactical-budget', hazards: [1, 2], minLedges: 1, cover: [2, 4] }],
  },
} satisfies BoardRecipeInput;
