import type {
  AttributeProfile,
  AttributeProfiles,
  GroupWeights,
} from '../tokens/equipment/attribute-profile-schema';
import type { PerMapTier } from '../tokens/equipment/equipment-keys';
import { MAP_TIERS, type TMapTier } from '../tokens/token-keys';
import type { EquipmentAttributeKey } from './equipment-attributes.content';

type Range = readonly [min: number, max: number];

interface ProfileRow {
  weight: GroupWeights;
  minTier?: TMapTier;
  tiers: PerMapTier<Range>;
}

const ROWS: Readonly<Partial<Record<EquipmentAttributeKey, ProfileRow>>> = {
  'crit-chance': {
    weight: { weapon: 45 },
    tiers: [
      [2, 2],
      [2, 4],
      [2, 6],
      [2, 10],
    ],
  },
  'crit-dmg': {
    weight: { weapon: 20 },
    minTier: 2,
    tiers: [
      [3, 3],
      [3, 3],
      [3, 4],
      [3, 5],
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
      [1, 2],
      [1, 3],
      [1, 4],
    ],
  },
  heart: {
    weight: { defense: 40, clothing: 35 },
    tiers: [
      [1, 2],
      [1, 4],
      [1, 6],
      [1, 8],
    ],
  },
  'heal-on-block': {
    weight: { defense: 20 },
    tiers: [
      [1, 1],
      [1, 2],
      [1, 3],
      [1, 4],
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
      [3, 5],
      [2, 5],
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
    weight: { weapon: 35, defense: 35, clothing: 35, jewelry: 35, burden: 35, charm: 35 },
    tiers: [
      [1, 10],
      [1, 20],
      [1, 30],
      [1, 40],
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
  wisdom: {
    weight: { jewelry: 30 },
    tiers: [
      [1, 1],
      [1, 2],
      [1, 3],
      [1, 4],
    ],
  },
};

const COUNT_WEIGHTS: PerMapTier<readonly number[]> = [
  [55, 40, 5],
  [40, 45, 15],
  [25, 50, 25],
  [10, 50, 40],
];

export const ATTRIBUTE_MAX_COUNT = 2;

function profileFor(tier: TMapTier): AttributeProfile {
  const index = MAP_TIERS.indexOf(tier);
  return {
    maxCount: ATTRIBUTE_MAX_COUNT,
    countWeights: [...COUNT_WEIGHTS[index]],
    attributes: Object.fromEntries(
      Object.entries(ROWS)
        .filter(([, row]) => tier >= (row.minTier ?? MAP_TIERS[0]))
        .map(([key, row]) => {
          const [min, max] = row.tiers[index];
          return [key, { weight: { ...row.weight }, min, max, step: 1 }];
        }),
    ),
  };
}

export const ATTRIBUTE_PROFILES = Object.fromEntries(
  MAP_TIERS.map((tier) => [`tier-${tier}`, profileFor(tier)]),
) as AttributeProfiles;
