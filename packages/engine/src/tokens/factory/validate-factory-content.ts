import type { AttributeRegistry, TypeRegistry, UniqueRegistry, WordPool } from '../registries';
import { attributeFailure } from '../attribute-rules';
import { hasGeneratedName } from '../token-content-schema';
import { wordKeyOf } from '../token-keys';

export function validateFactoryContent(registries: {
  types: TypeRegistry;
  attributes: AttributeRegistry;
  words: WordPool;
  uniques: UniqueRegistry;
}): void {
  const { types, attributes, words, uniques } = registries;
  for (const attribute of attributes.all()) {
    for (const key of attribute.allowedTypes ?? []) {
      if (!types.has(key)) throw new Error(`Unknown allowed type ${key}`);
    }
  }
  for (const type of types.all()) {
    if (type.nounKey !== wordKeyOf('noun', type.key))
      throw new Error(`Invalid noun for ${type.key}`);
    if (!hasGeneratedName(type)) continue;
    for (const realm of type.realms) {
      const prefixes = words.prefixes(realm);
      if (
        !prefixes.length ||
        prefixes.some((prefix) => !words.suffixesAfter(realm, prefix).length)
      ) {
        throw new Error(`No compatible name words for ${realm}+${type.key}`);
      }
    }
  }
  for (const unique of uniques.all()) {
    if (!types.has(unique.type)) throw new Error(`Unknown unique type ${unique.type}`);
    for (const attribute of unique.attributes) {
      const failure = attributeFailure(attributes, unique.type, attribute);
      if (failure) throw new Error(`Unique ${unique.key}: ${failure}`);
    }
  }
}
