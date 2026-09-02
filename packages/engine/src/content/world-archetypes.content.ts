import type { WorldArchetypeDef } from './world-section-schema';

export const WORLD_ARCHETYPES: WorldArchetypeDef[] = [
  {
    key: 'FORKED_FRONTIER',
    requiredTags: ['BRANCH', 'OPEN_AREA', 'CHOKEPOINT', 'POCKET'],
    weight: 1,
  },
];
