import type {
  AttributeProfile,
  AttributeProfiles,
  GroupWeights,
} from '../tokens/equipment/attribute-profile-schema';
import type { TAttributeProfileTier } from '../tokens/equipment/equipment-keys';

type Range = readonly [min: number, max: number];

interface ProfileRow {
  weight: GroupWeights;
  tiers: readonly [Range, Range, Range, Range];
}

const ROWS: Readonly<Record<string, ProfileRow>> = {
  crit: {
    weight: { weapon: 45 },
    tiers: [
      [4, 6],
      [5, 8],
      [7, 10],
      [9, 12],
    ],
  },
  'crit-dmg': {
    weight: { weapon: 20 },
    tiers: [
      [1, 1],
      [1, 1],
      [1, 1],
      [1, 2],
    ],
  },
  trophy: {
    weight: { weapon: 25 },
    tiers: [
      [1, 1],
      [1, 1],
      [1, 1],
      [1, 2],
    ],
  },
  yield: {
    weight: { weapon: 30 },
    tiers: [
      [1, 1],
      [1, 1],
      [1, 2],
      [1, 2],
    ],
  },
  shield: {
    weight: { defense: 40 },
    tiers: [
      [1, 1],
      [1, 1],
      [1, 1],
      [1, 2],
    ],
  },
  heart: {
    weight: { defense: 40, clothing: 35 },
    tiers: [
      [1, 1],
      [1, 1],
      [1, 2],
      [1, 2],
    ],
  },
  thorns: {
    weight: { defense: 20 },
    tiers: [
      [1, 1],
      [1, 1],
      [1, 1],
      [1, 2],
    ],
  },
  absorb: {
    weight: { clothing: 20 },
    tiers: [
      [1, 1],
      [1, 1],
      [1, 1],
      [1, 1],
    ],
  },
  fog: {
    weight: { clothing: 30 },
    tiers: [
      [1, 1],
      [1, 1],
      [1, 1],
      [1, 2],
    ],
  },
  'hero-crit': {
    weight: { clothing: 30 },
    tiers: [
      [1, 2],
      [1, 3],
      [2, 4],
      [3, 5],
    ],
  },
  'smart-step': {
    weight: { clothing: 30 },
    tiers: [
      [5, 5],
      [4, 5],
      [3, 4],
      [3, 3],
    ],
  },
  'deft-hands': {
    weight: { clothing: 30 },
    tiers: [
      [1, 1],
      [1, 1],
      [1, 1],
      [1, 2],
    ],
  },
  will: {
    weight: { jewelry: 35 },
    tiers: [
      [1, 2],
      [1, 3],
      [2, 4],
      [3, 5],
    ],
  },
  trade: {
    weight: { jewelry: 30 },
    tiers: [
      [2, 3],
      [2, 4],
      [3, 5],
      [4, 6],
    ],
  },
  focus: {
    weight: { jewelry: 30 },
    tiers: [
      [1, 1],
      [1, 1],
      [1, 1],
      [1, 2],
    ],
  },
  wisdom: {
    weight: { jewelry: 25 },
    tiers: [
      [1, 1],
      [1, 1],
      [1, 1],
      [1, 2],
    ],
  },
};

const COUNT_WEIGHTS: Readonly<Record<TAttributeProfileTier, readonly number[]>> = {
  'tier-1': [55, 40, 5],
  'tier-2': [40, 45, 15],
  'tier-3': [25, 50, 25],
  'tier-4': [10, 50, 40],
};

export const ATTRIBUTE_MAX_COUNT = 2;

function profileFor(tier: TAttributeProfileTier, index: number): AttributeProfile {
  return {
    maxCount: ATTRIBUTE_MAX_COUNT,
    countWeights: [...COUNT_WEIGHTS[tier]],
    attributes: Object.fromEntries(
      Object.entries(ROWS).map(([key, row]) => {
        const [min, max] = row.tiers[index];
        return [key, { weight: { ...row.weight }, min, max, step: 1 }];
      }),
    ),
  };
}

export const ATTRIBUTE_PROFILES: AttributeProfiles = {
  'tier-1': profileFor('tier-1', 0),
  'tier-2': profileFor('tier-2', 1),
  'tier-3': profileFor('tier-3', 2),
  'tier-4': profileFor('tier-4', 3),
};
