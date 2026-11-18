import { ERarityKind } from '../abstraction/hexobject-abstraction';
import { EHexActionType } from '../enums/hex-action-type';
import type { ItemTypeDefinition } from '../tokens/token-content-schema';
import { wordKeyOf } from '../tokens/token-keys';

const ALL_REALMS = [ERarityKind.GLOOM, ERarityKind.IDOL, ERarityKind.SPARK] as const;

export const ITEM_TYPES: readonly ItemTypeDefinition[] = [
  {
    key: 'sword',
    slot: 'weapon',
    strike: 2,
    tool: null,
    nounKey: wordKeyOf('noun', 'sword'),
    realms: [...ALL_REALMS],
  },
  {
    key: 'shield',
    slot: 'shield',
    strike: 1,
    block: { sides: 1 },
    tool: null,
    nounKey: wordKeyOf('noun', 'shield'),
    realms: [...ALL_REALMS],
  },
  {
    key: 'axe',
    slot: 'weapon',
    strike: 1,
    tool: { action: EHexActionType.CUT },
    nounKey: wordKeyOf('noun', 'axe'),
    realms: [...ALL_REALMS],
  },
  {
    key: 'pickaxe',
    slot: 'weapon',
    strike: 1,
    tool: { action: EHexActionType.MINE },
    nounKey: wordKeyOf('noun', 'pickaxe'),
    realms: [...ALL_REALMS],
  },
];
