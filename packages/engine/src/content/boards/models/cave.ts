import { HEXOBJECT_KEYS } from '../../../registry/hexobjects-registry';
import { BOARD_COLUMNS, BOARD_ROWS } from '../../../boards/board-size';
import type { BoardRecipeInput } from '../recipe-schema';

export const CAVE_MODEL = {
  id: 'cave',
  version: 1,
  kind: 'generated',
  frame: { columns: BOARD_COLUMNS, rows: BOARD_ROWS },
  biome: 'CAVE',
  background: '/hex-assets/board-hexes/stone-hex.png',
  fog: 'FOG',
  willZone: 'paid',
  entryObject: HEXOBJECT_KEYS.CAVE_EXIT,
  fallbackSeed: 'cave-fallback',
  params: { tier: [1, 4] },
  stages: {
    form: [{ kind: 'blobs', count: [4, 5], radius: 2, link: 'branch' }],
    bounds: [{ kind: 'wall', enclose: true }],
    gates: [{ kind: 'entry' }],
    objects: [
      {
        kind: 'rules',
        rules: [
          {
            id: 'rocks',
            pick: HEXOBJECT_KEYS.ROCK,
            count: [3, 6],
            where: { steps: [2, 12], spacing: 1 },
          },
          { id: 'rest', pick: { tag: 'rest' }, count: [1, 2], where: { region: 'room' } },
          { id: 'treasure', pick: { tag: 'treasure' }, count: 1, where: { region: 'deep' } },
          { id: 'guard', pick: HEXOBJECT_KEYS.SKELETOR, count: [1, 2], where: { region: 'deep' } },
        ],
      },
    ],
    checks: [{ kind: 'shape', minRegions: 4, minRegionHexes: 19 }, { kind: 'reachable' }],
  },
} satisfies BoardRecipeInput;
