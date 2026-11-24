import { BASE_ITEMS } from './base-items.content';
import { BaseItemRegistry } from '../tokens/base-item-registry';
import type { BaseItemDefinition } from '../tokens/base-item';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { attributeFormatKeys } from '../tokens/attribute-display';
import type { Adjective } from '../tokens/equipment/adjective-schema';
import type { AttributeProfiles } from '../tokens/equipment/attribute-profile-schema';
import type { EquipmentAttributeDefinition } from '../tokens/equipment/equipment-attribute-schema';
import { descriptionLocaleKeys } from '../tokens/factory/description-builder';
import { AttributeRegistry, TypeRegistry, UniqueRegistry } from '../tokens/registries';
import type {
  ItemTypeDefinition,
  TokenPriceRanges,
  WordPoolData,
} from '../tokens/token-content-schema';
import type { UniqueTokenContent } from '../tokens/unique-schema';
import { ATTRIBUTE_PROFILES } from './attribute-profiles.content';
import { EQUIPMENT_ATTRIBUTES } from './equipment-attributes.content';
import { ITEM_TYPES } from './item-types.content';
import { TOKEN_ADJECTIVES } from './token-adjectives.content';
import { TOKEN_PRICE_RANGES } from './token-prices.content';
import { TOKEN_UNIQUES } from './token-uniques.content';
import {
  TOKEN_ADJECTIVE_NAME_TEMPLATE_KEY,
  TOKEN_NAME_TEMPLATE_KEYS,
  TOKEN_WORDS,
} from './token-words.content';

export interface TokenContent {
  types: readonly ItemTypeDefinition[];
  baseItems: readonly BaseItemDefinition[];
  attributes: readonly EquipmentAttributeDefinition[];
  profiles: AttributeProfiles;
  adjectives: readonly Adjective[];
  words: WordPoolData;
  priceRanges: TokenPriceRanges;
}

export const TOKEN_CONTENT: TokenContent = {
  types: ITEM_TYPES,
  baseItems: BASE_ITEMS,
  attributes: EQUIPMENT_ATTRIBUTES,
  profiles: ATTRIBUTE_PROFILES,
  adjectives: TOKEN_ADJECTIVES,
  words: TOKEN_WORDS,
  priceRanges: TOKEN_PRICE_RANGES,
};

export const TOKEN_PRICE_ANCHOR_KEY = HEXOBJECT_KEYS.SWORD;

export function createTokenRegistries(
  content: TokenContent = TOKEN_CONTENT,
  uniques: readonly UniqueTokenContent[] = TOKEN_UNIQUES,
) {
  const types = new TypeRegistry(content.types);
  const attributes = new AttributeRegistry(content.attributes);
  return {
    types,
    baseItems: new BaseItemRegistry(content.baseItems, types, attributes),
    attributes,
    uniques: new UniqueRegistry(uniques),
  };
}

export function tokenLocaleKeys(
  content: TokenContent = TOKEN_CONTENT,
  uniques: readonly UniqueTokenContent[] = TOKEN_UNIQUES,
): string[] {
  return [
    ...Object.values(TOKEN_NAME_TEMPLATE_KEYS),
    TOKEN_ADJECTIVE_NAME_TEMPLATE_KEY,
    ...content.types.map((type) => type.nounKey),
    ...content.words.prefixes.map((word) => word.key),
    ...content.words.suffixes.map((word) => word.key),
    ...descriptionLocaleKeys(),
    ...attributeFormatKeys(),
    ...uniques.flatMap((unique) => [
      unique.name.nameKey,
      ...(unique.descriptionKey ? [unique.descriptionKey] : []),
    ]),
  ];
}
