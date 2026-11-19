import type { TokenContent } from '../../content/token-content';
import { attributeFailure } from '../attribute-rules';
import { attributeProfilesSchema } from '../equipment/attribute-profile-schema';
import { ADJECTIVE_BANDS } from '../equipment/equipment-keys';
import type { AttributeRegistry, TypeRegistry, UniqueRegistry } from '../registries';
import { hasGeneratedName } from '../token-content-schema';
import { wordKeyOf } from '../token-keys';
import { adjectivesForType } from './name-generator';

const UNIQUE_CHECK = { origin: 'unique' } as const;

export function validateFactoryContent(registries: {
  types: TypeRegistry;
  attributes: AttributeRegistry;
  uniques: UniqueRegistry;
  content: Pick<TokenContent, 'profiles' | 'adjectives'>;
}): void {
  const { types, attributes, uniques, content } = registries;
  attributeProfilesSchema.parse(content.profiles);
  for (const type of types.all()) {
    if (type.nounKey !== wordKeyOf('noun', type.key))
      throw new Error(`Invalid noun for ${type.key}`);
    if (!type.group || !type.gender || !type.materials)
      throw new Error(`Type ${type.key} needs a group, a gender and materials`);
    if (!hasGeneratedName(type)) continue;
    for (const band of ADJECTIVE_BANDS) {
      if (!adjectivesForType(type, band, content.adjectives).length)
        throw new Error(`No ${band} adjective for ${type.key}`);
    }
  }
  for (const unique of uniques.all()) {
    if (!types.has(unique.type)) throw new Error(`Unknown unique type ${unique.type}`);
    for (const attribute of unique.attributes) {
      const failure = attributeFailure(
        attributes,
        types.get(unique.type),
        attribute,
        UNIQUE_CHECK,
        1,
      );
      if (failure) throw new Error(`Unique ${unique.key}: ${failure}`);
    }
  }
}
