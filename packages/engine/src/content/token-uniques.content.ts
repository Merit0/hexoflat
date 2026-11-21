import { ERarityKind } from '../abstraction/hexobject-abstraction';
import type { UniqueTokenDefinition } from '../tokens/unique-schema';
import { uniqueTextKeys } from '../tokens/unique-schema';

function authored(key: string) {
  const text = uniqueTextKeys(key);
  return {
    key,
    name: { kind: 'authored' as const, nameKey: text.name },
    descriptionKey: text.description,
  };
}

export const TOKEN_UNIQUES: readonly UniqueTokenDefinition[] = [
  {
    ...authored('lantern-eater'),
    type: 'sword',
    rarity: ERarityKind.GLOOM,
    attributes: [{ key: 'heart', value: 1 }],
    skills: [],
    price: 900,
    revision: 1,
  },
  {
    ...authored('last-verdict'),
    type: 'sword',
    rarity: ERarityKind.GOD_EXECUTOR,
    attributes: [{ key: 'heart', value: 2 }],
    skills: ['b_strike'],
    price: 2400,
    revision: 1,
  },
];
