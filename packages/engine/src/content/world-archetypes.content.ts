import type { WorldArchetypeDef } from './world-section-schema';

export const WORLD_ARCHETYPES: WorldArchetypeDef[] = [
  {
    key: 'FORKED_FRONTIER',
    requiredTags: ['OPEN_FIELD', 'RIDGE_FIELD', 'FRONTIER_FIELD'],
    weight: 3,
  },
  {
    key: 'RIDGE_AND_POCKET',
    requiredTags: ['RIDGE_FIELD', 'POCKET', 'FRONTIER_FIELD'],
    weight: 2,
  },
  {
    key: 'OPEN_FIELD_NARROW_PASS',
    requiredTags: ['OPEN_FIELD', 'WOODED', 'FRONTIER_FIELD'],
    weight: 2,
  },
  {
    key: 'LANDMARK_PULL',
    requiredTags: ['OPEN_FIELD', 'BROKEN', 'FRONTIER_FIELD'],
    weight: 1,
  },
];
