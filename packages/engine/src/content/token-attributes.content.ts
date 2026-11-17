import type { AttributeDefinition } from '../tokens/token-content-schema';

export const TOKEN_ATTRIBUTES: readonly AttributeDefinition[] = [
  { key: 'heart', valueByTier: { 1: 1, 2: 1, 3: 2, 4: 2 }, weight: 1, implemented: true },
  {
    key: 'shield',
    valueByTier: { 1: 1, 2: 1, 3: 1, 4: 2 },
    weight: 1,
    allowedTypes: ['shield'],
    implemented: false,
  },
  { key: 'force', valueByTier: { 1: 1, 2: 1, 3: 2, 4: 2 }, weight: 1, implemented: false },
  { key: 'mass', valueByTier: { 1: 1, 2: 2, 3: 2, 4: 3 }, weight: 1, implemented: false },
  { key: 'will', valueByTier: { 1: 2, 2: 3, 3: 4, 4: 5 }, weight: 1, implemented: false },
  { key: 'fog', valueByTier: { 1: 1, 2: 1, 3: 1, 4: 2 }, weight: 1, implemented: false },
  { key: 'bag', valueByTier: { 1: 1, 2: 1, 3: 2, 4: 2 }, weight: 1, implemented: false },
];
