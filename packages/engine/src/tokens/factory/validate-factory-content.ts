import type { TokenContent } from '../../content/token-content';
import { attributeFailure, attributeSetFailure } from '../attribute-rules';
import { attributeProfilesSchema } from '../equipment/attribute-profile-schema';
import {
  adjectivesFor,
  baseAllowlistFailures,
  profileEntryFailures,
} from '../equipment/equipment-content-rules';
import { ADJECTIVE_BANDS } from '../equipment/equipment-keys';
import type { AttributeRegistry, TypeRegistry, UniqueRegistry } from '../registries';
import { hasGeneratedName } from '../token-content-schema';
import { wordKeyOf } from '../token-keys';

const UNIQUE_CHECK = { tier: 'unique' } as const;

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

function uniqueFailures(
  types: TypeRegistry,
  attributes: AttributeRegistry,
  uniques: UniqueRegistry,
): string[] {
  return uniques.all().flatMap((unique) => {
    if (!types.has(unique.type)) return [`Unknown unique type ${unique.type}`];
    const failures = unique.attributes.flatMap((attribute) => {
      const failure = attributeFailure(
        attributes,
        types.get(unique.type),
        attribute,
        UNIQUE_CHECK,
        1,
      );
      return failure ? [`Unique ${unique.key}: ${failure}`] : [];
    });
    const missing = attributeSetFailure(attributes, types.get(unique.type), unique.attributes);
    return missing ? [...failures, `Unique ${unique.key}: ${missing}`] : failures;
  });
}

export function validateFactoryContent(registries: {
  types: TypeRegistry;
  attributes: AttributeRegistry;
  uniques: UniqueRegistry;
  content: Pick<TokenContent, 'profiles' | 'adjectives' | 'baseItems'>;
}): void {
  const { types, attributes, uniques, content } = registries;
  const profiles = attributeProfilesSchema.parse(content.profiles);
  const definitions = attributes.all();
  const [failure] = [
    ...profileEntryFailures(profiles, definitions),
    ...typeFailures(types, content),
    ...uniqueFailures(types, attributes, uniques),
    ...baseAllowlistFailures(content.baseItems, types.all(), definitions, profiles),
  ];
  if (failure) throw new Error(failure);
}
