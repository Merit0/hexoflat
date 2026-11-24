import type { AttributeProfiles } from './equipment/attribute-profile-schema';
import { ATTRIBUTE_PROFILE_TIERS, type TAttributeProfileTier } from './equipment/equipment-keys';
import { attributeGeneratable } from './equipment/equipment-content-rules';
import { attributeSetFailure, authoredAttributeFailure } from './attribute-rules';
import type { AttributeRegistry, TypeRegistry, UniqueRegistry } from './registries';
import type { ItemTypeDefinition } from './token-content-schema';
import type { TokenAttribute } from './token-schema';
import type { UniqueTokenDefinition } from './unique-schema';

export interface UniqueRuleContext {
  types: TypeRegistry;
  attributes: AttributeRegistry;
  uniques: UniqueRegistry;
  uniqueProfiles: AttributeProfiles;
}

function authoredMaxima(unique: UniqueTokenDefinition): TokenAttribute[] {
  return unique.authoredAttributes.map(({ attribute, max }) => ({ key: attribute, value: max }));
}

function generatedMaxima(
  type: ItemTypeDefinition,
  tier: TAttributeProfileTier,
  taken: ReadonlySet<string>,
  { attributes, uniqueProfiles }: UniqueRuleContext,
): TokenAttribute[] {
  return Object.entries(uniqueProfiles[tier].attributes)
    .filter(([key, entry]) => !taken.has(key) && type.group && entry.weight[type.group])
    .filter(([key]) => attributes.has(key) && attributeGeneratable(attributes.get(key), type))
    .map(([key, entry]) => ({ key, value: entry.max }));
}

function templateFailures(unique: UniqueTokenDefinition, rules: UniqueRuleContext): string[] {
  if (!rules.types.has(unique.type)) return [`names unknown type ${unique.type}`];
  const type = rules.types.get(unique.type);
  if (!type.group) return [`type ${type.key} has no group`];
  const failures = unique.authoredAttributes.flatMap(
    (entry) => authoredAttributeFailure(rules.attributes, type, entry) ?? [],
  );
  const authored = authoredMaxima(unique);
  const authoredFailure = attributeSetFailure(rules.attributes, type, authored);
  if (authoredFailure) return [...failures, authoredFailure];
  const taken = new Set(authored.map((attribute) => attribute.key));
  const combined = ATTRIBUTE_PROFILE_TIERS.flatMap((tier) => {
    const generated = generatedMaxima(type, tier, taken, rules);
    const failure = attributeSetFailure(rules.attributes, type, [...generated, ...authored]);
    return failure ? [`${tier}: ${failure}`] : [];
  });
  return [...failures, ...combined];
}

export function uniqueTemplateFailures(rules: UniqueRuleContext): string[] {
  return rules.uniques
    .all()
    .flatMap((unique) =>
      templateFailures(unique, rules).map((failure) => `unique ${unique.key}: ${failure}`),
    );
}
