import { HEXOBJECT_KEYS } from '../../../registry/hexobjects-registry';
import type { GeneratedBoardPreset } from '../schemas';

export const CAVE_PRESET = {
  id: 'cave',
  layouts: ['fork-01', 'basin-01'],
  biome: 'CAVE',
  background: '/hex-assets/board-hexes/stone-hex.png',
  entryObject: HEXOBJECT_KEYS.CAVE_EXIT,
  slots: {
    resource: { hexobjectKey: HEXOBJECT_KEYS.ROCK, min: 3, max: 6 },
    poi: {
      hexobjectKeys: [
        HEXOBJECT_KEYS.CHEST,
        HEXOBJECT_KEYS.FIREPLACE,
        HEXOBJECT_KEYS.HEALING_SPRING,
      ],
      min: 1,
      max: 2,
    },
    enemy: { hexobjectKey: HEXOBJECT_KEYS.SKELETOR, min: 0, max: 1 },
  },
  fallbackChunks: {
    'fork-01': { A: 'cave-entry-fork-01', B: 'cave-hall-a', C: 'cave-hall-b' },
    'basin-01': { A: 'cave-entry-basin-01', B: 'cave-junction-01', C: 'cave-deadend-01' },
  },
} satisfies GeneratedBoardPreset;
