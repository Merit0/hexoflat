import { dimensionOfItemFamily } from '../dimensions/dimensions';
import { ERarityKind } from '../abstraction/hexobject-abstraction';
import type { ItemToken } from './token-schema';

export function sampleToken(overrides: Partial<ItemToken> = {}): ItemToken {
  return {
    id: 'chest:cave.4-7:0',
    origin: 'base',
    type: 'sword',
    ...(overrides.origin !== 'unique'
      ? {
          baseKey: `${dimensionOfItemFamily(overrides.rarity ?? ERarityKind.IDOL)}-${overrides.type ?? 'sword'}`,
        }
      : {}),
    rarity: ERarityKind.IDOL,
    dimension: dimensionOfItemFamily(overrides.rarity ?? ERarityKind.IDOL),
    name: {
      kind: 'generated',
      prefix: 'content.tokens.prefix.ash',
      noun: 'sword',
      suffix: 'content.tokens.suffix.warden',
    },
    description: [{ key: 'content.tokens.noun.sword', params: { strike: 2 } }],
    attributes: [{ key: 'heart', value: 1 }],
    skills: [],
    price: 500,
    sprite: 'idol-sword-01',
    mapTier: 1,
    generatorVersion: 1,
    ext: { aspects: [], heroGrade: null },
    ...overrides,
  };
}
