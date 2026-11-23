import type { AttributeProfiles } from './equipment/attribute-profile-schema';
import type { EquipmentAttributeDefinition } from './equipment/equipment-attribute-schema';
import type { AttributeRegistry } from './registries';
import type { ItemTypeDefinition } from './token-content-schema';
import type { TMapTier } from './token-keys';
import type { TokenAttribute } from './token-schema';

export type AttributeCheck = { origin: 'base'; profiles: AttributeProfiles } | { origin: 'unique' };

export type AttributeTarget = Pick<ItemTypeDefinition, 'key' | 'tool' | 'group'>;

function profileKey(tier: TMapTier): keyof AttributeProfiles {
  return `tier-${tier}`;
}

function typeFailure(
  definition: EquipmentAttributeDefinition,
  type: AttributeTarget,
): string | null {
  if (definition.onlyTypes && !definition.onlyTypes.includes(type.key)) {
    return `Attribute ${definition.key} is not allowed on type ${type.key}`;
  }
  if (definition.excludes?.tool && type.tool !== null) {
    return `Attribute ${definition.key} is not allowed on tool type ${type.key}`;
  }
  if (definition.requires?.tool && type.tool === null) {
    return `Attribute ${definition.key} needs a tool, type ${type.key} is not one`;
  }
  return null;
}

function baseFailure(
  definition: EquipmentAttributeDefinition,
  type: AttributeTarget,
  attribute: TokenAttribute,
  range: { profiles: AttributeProfiles; tier: TMapTier },
): string | null {
  if (definition.deprecated) return `Attribute ${definition.key} is deprecated`;
  if (!type.group || !definition.groups.includes(type.group)) {
    return `Attribute ${definition.key} is not allowed on group ${type.group ?? 'none'}`;
  }
  const entry = range.profiles[profileKey(range.tier)].attributes[definition.key];
  if (!entry || entry.weight[type.group] === undefined) {
    return `Attribute ${definition.key} has no tier ${range.tier} range for ${type.group}`;
  }
  const { value } = attribute;
  if (value < entry.min || value > entry.max || (value - entry.min) % entry.step !== 0) {
    return `Attribute ${definition.key} value ${value} is outside [${entry.min}, ${entry.max}] step ${entry.step} for tier ${range.tier}`;
  }
  return null;
}

function uniqueFailure(
  definition: EquipmentAttributeDefinition,
  attribute: TokenAttribute,
): string | null {
  if (definition.cap !== undefined && attribute.value > definition.cap) {
    return `Attribute ${definition.key} value ${attribute.value} is above the cap ${definition.cap}`;
  }
  return null;
}

export function attributeFailure(
  registry: AttributeRegistry,
  type: AttributeTarget,
  attribute: TokenAttribute,
  check: AttributeCheck,
  tier: TMapTier,
): string | null {
  if (!registry.has(attribute.key)) return `Attribute ${attribute.key} is unknown`;
  const definition = registry.get(attribute.key);
  if (!definition.implemented) return `Attribute ${attribute.key} is not implemented`;
  if (!Number.isSafeInteger(attribute.value) || attribute.value < 1) {
    return `Attribute ${attribute.key} value ${attribute.value} is not a whole number from 1`;
  }
  const failure = typeFailure(definition, type);
  if (failure) return failure;
  return check.origin === 'base'
    ? baseFailure(definition, type, attribute, { profiles: check.profiles, tier })
    : uniqueFailure(definition, attribute);
}
