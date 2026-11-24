import type { AttributeProfiles } from './equipment/attribute-profile-schema';
import { aggregateValues, totalCapOf } from './equipment/stat-values';
import { typeBaseStats } from './equipment/type-base-stats';
import type { EquipmentAttributeDefinition } from './equipment/equipment-attribute-schema';
import type { AttributeRegistry } from './registries';
import type { ItemTypeDefinition } from './token-content-schema';
import type { TMapTier } from './token-keys';
import type { TokenAttribute } from './token-schema';
import type { AuthoredAttribute } from './unique-schema';

export type AttributeCheck =
  | { tier: 'base'; profiles: AttributeProfiles }
  | { tier: 'unique'; profiles: AttributeProfiles; authored: readonly AuthoredAttribute[] };

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

function rolledFailure(
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

function authoredRangeFailure(entry: AuthoredAttribute, attribute: TokenAttribute): string | null {
  if (attribute.value >= entry.min && attribute.value <= entry.max) return null;
  return `Attribute ${entry.attribute} value ${attribute.value} is outside its authored [${entry.min}, ${entry.max}]`;
}

function dependencyFailure(
  registry: AttributeRegistry,
  attributes: readonly TokenAttribute[],
): string | null {
  const keys = new Set(attributes.map((attribute) => attribute.key));
  for (const attribute of attributes) {
    if (!registry.has(attribute.key)) continue;
    const missing = (registry.get(attribute.key).requires?.attributes ?? []).filter(
      (key) => !keys.has(key),
    );
    if (missing.length > 0) {
      return `Attribute ${attribute.key} needs ${missing.join(', ')} on the same item`;
    }
  }
  return null;
}

function carrierFailure(
  registry: AttributeRegistry,
  type: AttributeTarget,
  key: string,
): string | null {
  if (!registry.has(key)) return `Attribute ${key} is unknown`;
  const definition = registry.get(key);
  if (!definition.implemented) return `Attribute ${key} is not implemented`;
  return typeFailure(definition, type);
}

export function authoredAttributeFailure(
  registry: AttributeRegistry,
  type: AttributeTarget,
  entry: AuthoredAttribute,
): string | null {
  const failure = carrierFailure(registry, type, entry.attribute);
  if (failure) return failure;
  const { itemMax } = registry.get(entry.attribute);
  if (itemMax === undefined || entry.max <= itemMax) return null;
  return `Attribute ${entry.attribute} value ${entry.max} is above its itemMax ${itemMax}`;
}

export function attributeFailure(
  registry: AttributeRegistry,
  type: AttributeTarget,
  attribute: TokenAttribute,
  check: AttributeCheck,
  tier: TMapTier,
): string | null {
  const failure = carrierFailure(registry, type, attribute.key);
  if (failure) return failure;
  if (!Number.isSafeInteger(attribute.value) || attribute.value < 1) {
    return `Attribute ${attribute.key} value ${attribute.value} is not a whole number from 1`;
  }
  const authored =
    check.tier === 'unique' && check.authored.find((entry) => entry.attribute === attribute.key);
  if (authored) return authoredRangeFailure(authored, attribute);
  const range = { profiles: check.profiles, tier };
  return rolledFailure(registry.get(attribute.key), type, attribute, range);
}

function totalCapFailure(
  registry: AttributeRegistry,
  type: Pick<ItemTypeDefinition, 'block' | 'base'>,
  attributes: readonly TokenAttribute[],
): string | null {
  const base = typeBaseStats(type);
  const implemented = registry.all().filter((definition) => definition.implemented);
  for (const stat of new Set(implemented.map((definition) => definition.stat))) {
    if (stat === null) continue;
    const definitions = implemented.filter((definition) => definition.stat === stat);
    const cap = totalCapOf(definitions);
    const keys = new Set(definitions.map((definition) => definition.key));
    const values = attributes
      .filter((attribute) => keys.has(attribute.key))
      .map((attribute) => attribute.value);
    if (cap === Infinity || values.length === 0) continue;
    const own = definitions[0].scope === 'hero' && base[stat] ? [base[stat]] : [];
    const total = aggregateValues([...own, ...values], definitions[0].aggregate);
    if (total > cap) return `Item stat ${stat} ${total} is above its totalCap ${cap}`;
  }
  return null;
}

export function attributeSetFailure(
  registry: AttributeRegistry,
  type: Pick<ItemTypeDefinition, 'block' | 'base'>,
  attributes: readonly TokenAttribute[],
): string | null {
  return dependencyFailure(registry, attributes) ?? totalCapFailure(registry, type, attributes);
}
