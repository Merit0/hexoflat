import { dimensionOfTokenType } from '../dimensions/dimensions';
import { ETokenType } from '../abstraction/hexobject-abstraction';
import type { ItemToken } from './token-schema';

export function sampleToken(overrides: Partial<ItemToken> = {}): ItemToken {
  return {
    id: 'chest:cave.4-7:0',
    tier: 'base',
    type: 'sword',
    ...(overrides.tier !== 'unique'
      ? {
          baseKey: `${dimensionOfTokenType(overrides.tokenType ?? ETokenType.IDOL)}-${overrides.type ?? 'sword'}`,
          sprite: `${overrides.tokenType ?? ETokenType.IDOL}-${overrides.type ?? 'sword'}-01`,
        }
      : {}),
    tokenType: ETokenType.IDOL,
    dimension: dimensionOfTokenType(overrides.tokenType ?? ETokenType.IDOL),
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
    mapTier: 1,
    generatorVersion: 1,
    ext: { aspects: [], heroGrade: null },
    ...overrides,
  };
}
