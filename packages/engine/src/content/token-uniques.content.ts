import { EDimension } from '../dimensions/dimensions';
import { ETokenType } from '../abstraction/hexobject-abstraction';
import type { UniqueTokenContent } from '../tokens/unique-schema';
import { uniqueTextKeys } from '../tokens/unique-schema';

function authored(key: string) {
  const text = uniqueTextKeys(key);
  return {
    key,
    name: { kind: 'authored' as const, nameKey: text.name },
    descriptionKey: text.description,
  };
}

export const TOKEN_UNIQUES: readonly UniqueTokenContent[] = [
  {
    ...authored('lantern-eater'),
    type: 'sword',
    tokenType: ETokenType.GLOOM,
    dimension: EDimension.UNDERWORLD,
    authoredAttributes: [{ attribute: 'heart', min: 1, max: 1 }],
    skills: [],
    price: 900,
    revision: 1,
  },
  {
    ...authored('last-verdict'),
    type: 'sword',
    tokenType: ETokenType.ALIEN,
    dimension: EDimension.NOWHERE,
    authoredAttributes: [{ attribute: 'heart', min: 2, max: 2 }],
    skills: ['b_strike'],
    price: 2400,
    revision: 1,
  },
];
