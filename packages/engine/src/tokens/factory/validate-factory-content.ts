import type { TokenContent } from '../../content/token-content';
import {
  attributeProfilesSchema,
  type AttributeProfiles,
} from '../equipment/attribute-profile-schema';
import {
  adjectivesFor,
  baseAllowlistFailures,
  profileEntryFailures,
} from '../equipment/equipment-content-rules';
import { ADJECTIVE_BANDS } from '../equipment/equipment-keys';
import type { AttributeRegistry, TypeRegistry, UniqueRegistry } from '../registries';
import { hasGeneratedName } from '../token-content-schema';
import { wordKeyOf } from '../token-keys';
import { uniqueTemplateFailures } from '../unique-content-rules';

function typeFailures(types: TypeRegistry, content: Pick<TokenContent, 'adjectives'>): string[] {
  return types.all().flatMap((type) => {
    if (type.nounKey !== wordKeyOf('noun', type.key)) return [`Invalid noun for ${type.key}`];
    if (!type.group || !type.gender || !type.materials)
      return [`Type ${type.key} needs a group, a gender and materials`];
    if (!hasGeneratedName(type)) return [];
    return ADJECTIVE_BANDS.filter(
      (band) => adjectivesFor(type, band, content.adjectives).length === 0,
    ).map((band) => `No ${band} adjective for ${type.key}`);
  });
}

export function validateFactoryContent(registries: {
  types: TypeRegistry;
  attributes: AttributeRegistry;
  uniques: UniqueRegistry;
  content: Pick<TokenContent, 'profiles' | 'adjectives' | 'baseItems'>;
  uniqueProfiles: AttributeProfiles;
}): void {
  const { types, attributes, uniques, content, uniqueProfiles } = registries;
  const profiles = attributeProfilesSchema.parse(content.profiles);
  const definitions = attributes.all();
  const [failure] = [
    ...profileEntryFailures(profiles, definitions),
    ...typeFailures(types, content),
    ...uniqueTemplateFailures({ types, attributes, uniques, uniqueProfiles }),
    ...baseAllowlistFailures(content.baseItems, types.all(), definitions, profiles),
  ];
  if (failure) throw new Error(failure);
}
