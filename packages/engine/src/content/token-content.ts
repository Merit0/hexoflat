import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { descriptionLocaleKeys } from '../tokens/factory/description-builder';
import { AttributeRegistry, TypeRegistry, UniqueRegistry, WordPool } from '../tokens/registries';
import type {
  AttributeDefinition,
  ItemTypeDefinition,
  TokenPriceRanges,
  WordPoolData,
} from '../tokens/token-content-schema';
import type { UniqueTokenDefinition } from '../tokens/unique-schema';
import { ITEM_TYPES } from './item-types.content';
import { TOKEN_ATTRIBUTES } from './token-attributes.content';
import { TOKEN_PRICE_RANGES } from './token-prices.content';
import { TOKEN_UNIQUES } from './token-uniques.content';
import { TOKEN_NAME_TEMPLATE_KEY, TOKEN_WORDS } from './token-words.content';

export interface TokenContent {
  types: readonly ItemTypeDefinition[];
  attributes: readonly AttributeDefinition[];
  words: WordPoolData;
  priceRanges: TokenPriceRanges;
}

export const TOKEN_CONTENT: TokenContent = {
  types: ITEM_TYPES,
  attributes: TOKEN_ATTRIBUTES,
  words: TOKEN_WORDS,
  priceRanges: TOKEN_PRICE_RANGES,
};

export const TOKEN_PRICE_ANCHOR_KEY = HEXOBJECT_KEYS.SWORD;

export function createTokenRegistries(
  content: TokenContent = TOKEN_CONTENT,
  uniques: readonly UniqueTokenDefinition[] = TOKEN_UNIQUES,
) {
  return {
    types: new TypeRegistry(content.types),
    attributes: new AttributeRegistry(content.attributes),
    words: new WordPool(content.words),
    uniques: new UniqueRegistry(uniques),
  };
}

export function tokenLocaleKeys(
  content: TokenContent = TOKEN_CONTENT,
  uniques: readonly UniqueTokenDefinition[] = TOKEN_UNIQUES,
): string[] {
  return [
    TOKEN_NAME_TEMPLATE_KEY,
    ...content.types.map((type) => type.nounKey),
    ...content.words.prefixes.map((word) => word.key),
    ...content.words.suffixes.map((word) => word.key),
    ...descriptionLocaleKeys(content.attributes.map((attribute) => attribute.key)),
    ...uniques.flatMap((unique) => [
      unique.name.nameKey,
      ...(unique.descriptionKey ? [unique.descriptionKey] : []),
    ]),
  ];
}
