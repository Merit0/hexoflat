import type { WorldArchetypeDef } from './world-section-schema';

export const WORLD_ARCHETYPES: WorldArchetypeDef[] = [
  {
    key: 'FORKED_FRONTIER',
    requiredTags: ['BRANCH', 'OPEN_AREA', 'CHOKEPOINT', 'POCKET'],
    weight: 3,
  },
  {
    key: 'RIDGE_AND_POCKET',
    requiredTags: ['BARRIER', 'POCKET', 'FRONTIER'],
    weight: 2,
  },
  {
    key: 'OPEN_FIELD_NARROW_PASS',
    requiredTags: ['OPEN_AREA', 'CHOKEPOINT', 'FRONTIER'],
    weight: 2,
  },
  {
    key: 'LANDMARK_PULL',
    requiredTags: ['FRONTIER', 'BRANCH', 'CHOKEPOINT'],
    weight: 1,
  },
];
