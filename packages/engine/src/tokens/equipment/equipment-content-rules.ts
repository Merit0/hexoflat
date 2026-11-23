import type { BaseItemDefinition } from '../base-item';
import type { ItemTypeDefinition } from '../token-content-schema';
import { adjectiveFits, type Adjective } from './adjective-schema';
import type { AttributeProfiles } from './attribute-profile-schema';
import type { EquipmentAttributeDefinition } from './equipment-attribute-schema';
import {
  ATTRIBUTE_PROFILE_TIERS,
  type TAdjectiveBand,
  type TAttributeProfileTier,
  type THeroStat,
  type TItemGroup,
} from './equipment-keys';

export type RuleType = Pick<ItemTypeDefinition, 'key' | 'tool' | 'group' | 'block' | 'base'>;
export type AdjectiveTargetType = Pick<ItemTypeDefinition, 'group' | 'materials'>;

export function attributeFitsType(
  definition: EquipmentAttributeDefinition,
  type: Pick<ItemTypeDefinition, 'key' | 'tool' | 'group'>,
): boolean {
  if (!type.group || !definition.groups.includes(type.group)) return false;
  if (definition.onlyTypes && !definition.onlyTypes.includes(type.key)) return false;
  if (definition.excludes?.tool && type.tool !== null) return false;
  return definition.requires?.tool !== true || type.tool !== null;
}

export function attributeGeneratable(
  definition: EquipmentAttributeDefinition,
  type: Pick<ItemTypeDefinition, 'key' | 'tool' | 'group'>,
): boolean {
  return (
    definition.implemented && definition.deprecated !== true && attributeFitsType(definition, type)
  );
}

export function adjectivesFor(
  type: AdjectiveTargetType,
  band: TAdjectiveBand,
  adjectives: readonly Adjective[],
): Adjective[] {
  if (!type.group || !type.materials) return [];
  const target = { group: type.group, materials: type.materials };
  return adjectives.filter(
    (adjective) => adjective.band === band && adjectiveFits(adjective, target),
  );
}

function byKey(
  attributes: readonly EquipmentAttributeDefinition[],
): ReadonlyMap<string, EquipmentAttributeDefinition> {
  return new Map(attributes.map((attribute) => [attribute.key, attribute] as const));
}

function profileEntries(profiles: AttributeProfiles) {
  return ATTRIBUTE_PROFILE_TIERS.flatMap((tier) =>
    Object.entries(profiles[tier].attributes).map(([key, entry]) => ({ tier, key, entry })),
  );
}

export function profileEntryFailures(
  profiles: AttributeProfiles,
  attributes: readonly EquipmentAttributeDefinition[],
): string[] {
  const known = byKey(attributes);
  return profileEntries(profiles).flatMap(({ tier, key, entry }) => {
    const attribute = known.get(key);
    if (!attribute) return [`${tier}: attribute ${key} is unknown`];
    const failures: string[] = [];
    if (attribute.stat === null) failures.push(`${tier}: attribute ${key} is blocked`);
    for (const group of Object.keys(entry.weight) as TItemGroup[]) {
      if (!attribute.groups.includes(group)) {
        failures.push(`${tier}: attribute ${key} has a weight for group ${group}`);
      }
    }
    if (attribute.itemMax !== undefined && entry.max > attribute.itemMax) {
      failures.push(
        `${tier}: attribute ${key} max ${entry.max} is above its itemMax ${attribute.itemMax}`,
      );
    }
    return failures;
  });
}

export function unreachableWeightFailures(
  profiles: AttributeProfiles,
  attributes: readonly EquipmentAttributeDefinition[],
  types: readonly RuleType[],
): string[] {
  const known = byKey(attributes);
  return profileEntries(profiles).flatMap(({ tier, key, entry }) => {
    const attribute = known.get(key);
    if (!attribute) return [];
    return (Object.keys(entry.weight) as TItemGroup[]).flatMap((group) => {
      const inGroup = types.filter((type) => type.group === group);
      if (inGroup.length === 0 || inGroup.some((type) => attributeFitsType(attribute, type))) {
        return [];
      }
      return [
        `${tier}: attribute ${key} has a weight for group ${group}, but no type there can carry it`,
      ];
    });
  });
}

export function unprofiledAttributeFailures(
  profiles: AttributeProfiles,
  attributes: readonly EquipmentAttributeDefinition[],
): string[] {
  const profiled = new Set(profileEntries(profiles).map(({ key }) => key));
  return attributes
    .filter((attribute) => attribute.implemented && attribute.deprecated !== true)
    .filter((attribute) => !profiled.has(attribute.key))
    .map((attribute) => `attribute ${attribute.key} is implemented but no tier profile rolls it`);
}

function groupByStat(
  attributes: readonly EquipmentAttributeDefinition[],
): ReadonlyMap<THeroStat, EquipmentAttributeDefinition[]> {
  const groups = new Map<THeroStat, EquipmentAttributeDefinition[]>();
  for (const attribute of attributes) {
    if (attribute.stat === null) continue;
    groups.set(attribute.stat, [...(groups.get(attribute.stat) ?? []), attribute]);
  }
  return groups;
}

function disagreement(
  stat: THeroStat,
  definitions: readonly EquipmentAttributeDefinition[],
  field: 'aggregate' | 'scope',
): string[] {
  const values = new Set(definitions.map((definition) => definition[field]));
  if (values.size <= 1) return [];
  const listed = definitions.map((definition) => `${definition.key} ${definition[field]}`);
  return [`stat ${stat} mixes ${field}s: ${listed.join(', ')}`];
}

export function statRuleFailures(attributes: readonly EquipmentAttributeDefinition[]): string[] {
  return [...groupByStat(attributes)].flatMap(([stat, definitions]) => [
    ...disagreement(stat, definitions, 'aggregate'),
    ...disagreement(
      stat,
      definitions.filter((definition) => definition.implemented),
      'scope',
    ),
  ]);
}

export function itemMaxFailures(attributes: readonly EquipmentAttributeDefinition[]): string[] {
  return attributes
    .filter((attribute) => attribute.implemented && attribute.deprecated !== true)
    .filter((attribute) => attribute.aggregate !== 'min')
    .filter((attribute) => attribute.itemMax === undefined)
    .map((attribute) => `attribute ${attribute.key} is implemented but has no itemMax`);
}

export function bandFailures(profiles: AttributeProfiles, bandCount: number): string[] {
  return ATTRIBUTE_PROFILE_TIERS.flatMap((tier) => {
    const { maxCount } = profiles[tier];
    if (maxCount + 1 <= bandCount) return [];
    return [
      `${tier}: maxCount ${maxCount} needs ${maxCount + 1} name and price bands, there are ${bandCount}`,
    ];
  });
}

function rolledSomewhere(
  profiles: AttributeProfiles,
  key: string,
  group: TItemGroup | undefined,
): boolean {
  return (
    group !== undefined &&
    ATTRIBUTE_PROFILE_TIERS.some(
      (tier) => profiles[tier].attributes[key]?.weight[group] !== undefined,
    )
  );
}

function allowlistKeyFailure(
  base: BaseItemDefinition,
  key: string,
  type: RuleType,
  attribute: EquipmentAttributeDefinition | undefined,
): string | null {
  const prefix = `base item ${base.key} allows ${key}`;
  if (!attribute) return `${prefix}, which is unknown`;
  if (!attribute.implemented) return `${prefix}, which is not implemented`;
  if (attribute.deprecated) return `${prefix}, which is deprecated`;
  if (!attributeFitsType(attribute, type)) return `${prefix}, which type ${type.key} cannot carry`;
  return null;
}

export function baseAllowlistFailures(
  baseItems: readonly BaseItemDefinition[],
  types: readonly RuleType[],
  attributes: readonly EquipmentAttributeDefinition[],
  profiles: AttributeProfiles,
): string[] {
  const known = byKey(attributes);
  return baseItems.flatMap((base) => {
    const type = types.find((candidate) => candidate.key === base.type);
    if (!base.attributes || base.attributes.length === 0 || !type) return [];
    const failures = base.attributes.flatMap((key) => {
      const failure = allowlistKeyFailure(base, key, type, known.get(key));
      return failure ? [failure] : [];
    });
    for (const key of base.attributes) {
      const missing = (known.get(key)?.requires?.attributes ?? []).filter(
        (required) => !base.attributes!.includes(required),
      );
      if (missing.length > 0) {
        failures.push(`base item ${base.key} allows ${key} without ${missing.join(', ')}`);
      }
    }
    if (!base.attributes.some((key) => rolledSomewhere(profiles, key, type.group))) {
      failures.push(`base item ${base.key} allows no attribute that a tier rolls on ${type.key}`);
    }
    return failures;
  });
}

function eligibleAt(
  attribute: EquipmentAttributeDefinition,
  type: RuleType,
  profiles: AttributeProfiles,
  tier: TAttributeProfileTier,
): boolean {
  return (
    type.group !== undefined &&
    attributeGeneratable(attribute, type) &&
    profiles[tier].attributes[attribute.key]?.weight[type.group] !== undefined
  );
}

function cycleFrom(
  key: string,
  known: ReadonlyMap<string, EquipmentAttributeDefinition>,
  path: readonly string[] = [],
): string[] | null {
  if (path.includes(key)) return [...path, key];
  for (const required of known.get(key)?.requires?.attributes ?? []) {
    const cycle = cycleFrom(required, known, [...path, key]);
    if (cycle) return cycle;
  }
  return null;
}

function reachFailures(
  attribute: EquipmentAttributeDefinition,
  required: EquipmentAttributeDefinition,
  profiles: AttributeProfiles,
  types: readonly RuleType[],
): string[] {
  return ATTRIBUTE_PROFILE_TIERS.flatMap((tier) =>
    types
      .filter((type) => eligibleAt(attribute, type, profiles, tier))
      .filter((type) => !eligibleAt(required, type, profiles, tier))
      .map(
        (type) =>
          `${tier}: attribute ${attribute.key} rolls on ${type.key} only after ${required.key}, which cannot roll there`,
      ),
  );
}

export function dependencyFailures(
  profiles: AttributeProfiles,
  attributes: readonly EquipmentAttributeDefinition[],
  types: readonly RuleType[],
): string[] {
  const known = byKey(attributes);
  return attributes.flatMap((attribute) => {
    const requires = attribute.requires?.attributes ?? [];
    if (requires.length === 0) return [];
    const unknown = requires.filter((key) => !known.has(key));
    if (unknown.length > 0) {
      return [`attribute ${attribute.key} requires unknown ${unknown.join(', ')}`];
    }
    const cycle = cycleFrom(attribute.key, known);
    if (cycle) return [`attribute ${attribute.key} has a requirement cycle: ${cycle.join(' -> ')}`];
    const room = ATTRIBUTE_PROFILE_TIERS.filter(
      (tier) =>
        profiles[tier].attributes[attribute.key] !== undefined &&
        requires.length + 1 > profiles[tier].maxCount,
    ).map(
      (tier) =>
        `${tier}: attribute ${attribute.key} needs ${requires.length + 1} attributes, maxCount is ${profiles[tier].maxCount}`,
    );
    return [
      ...room,
      ...requires.flatMap((key) => reachFailures(attribute, known.get(key)!, profiles, types)),
    ];
  });
}
