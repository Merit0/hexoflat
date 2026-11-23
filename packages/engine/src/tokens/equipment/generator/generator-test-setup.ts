import { ATTRIBUTE_PROFILES } from '../../../content/attribute-profiles.content';
import { AttributeRegistry } from '../../registries';
import { EQUIPMENT_ATTRIBUTES } from '../../../content/equipment-attributes.content';
import { EQUIPMENT_TYPES } from '../../../content/item-types.content';
import type { TMapTier } from '../../token-keys';
import { MAP_TIERS } from '../../token-keys';
import type { TokenAttribute } from '../../token-schema';
import type { AttributeProfiles, ProfileAttribute } from '../attribute-profile-schema';
import {
  attributeHintKey,
  attributeLabelKey,
  type EquipmentAttributeDefinition,
} from '../equipment-attribute-schema';
import { ATTRIBUTE_PROFILE_TIERS, type THeroStat, type TItemGroup } from '../equipment-keys';
import type { EquipmentTypeDefinition } from '../equipment-type-schema';
import { seededRandomStreams } from './attribute-streams';
import { createEquipmentAttributeGenerator } from './create-equipment-attribute-generator';
import type { EquipmentAttributeGenerator } from './equipment-attribute-generator';

export const SEEDS = 500;
export const TIERS: readonly TMapTier[] = MAP_TIERS;
export const GENERATED_GROUPS: readonly TItemGroup[] = ['weapon', 'defense', 'clothing', 'jewelry'];

export const FIXTURE_ATTRIBUTES: readonly EquipmentAttributeDefinition[] = EQUIPMENT_ATTRIBUTES.map(
  (attribute) => (attribute.stat === null ? attribute : { ...attribute, implemented: true }),
);

export const FIXTURE_PROFILES: AttributeProfiles = ATTRIBUTE_PROFILES;

export function typesOf(group: TItemGroup): readonly EquipmentTypeDefinition[] {
  return EQUIPMENT_TYPES.filter((type) => type.group === group);
}

export function typeOf(key: string): EquipmentTypeDefinition {
  const type = EQUIPMENT_TYPES.find((candidate) => candidate.key === key);
  if (!type) throw new Error(`no type ${key}`);
  return type;
}

export function fixtureAttribute(
  key: string,
  fields: {
    groups: TItemGroup[];
    stat: THeroStat;
    onlyTypes?: string[];
    implemented?: boolean;
    deprecated?: boolean;
  },
): EquipmentAttributeDefinition {
  const { implemented = true, ...rest } = fields;
  return {
    key,
    ...rest,
    aggregate: 'sum',
    scope: 'hero',
    implemented,
    display: {
      labelKey: attributeLabelKey(key),
      hintKey: attributeHintKey(key),
      icon: 'star',
      format: 'plus',
    },
  };
}

export function withProfileRow(
  profiles: AttributeProfiles,
  key: string,
  row: ProfileAttribute,
): AttributeProfiles {
  return Object.fromEntries(
    ATTRIBUTE_PROFILE_TIERS.map((tier) => [
      tier,
      { ...profiles[tier], attributes: { ...profiles[tier].attributes, [key]: row } },
    ]),
  ) as AttributeProfiles;
}

export function fixtureGenerator(
  attributes: readonly EquipmentAttributeDefinition[] = FIXTURE_ATTRIBUTES,
  profiles: AttributeProfiles = FIXTURE_PROFILES,
): EquipmentAttributeGenerator {
  return createEquipmentAttributeGenerator(new AttributeRegistry(attributes), profiles);
}

export function rollFor(
  generator: EquipmentAttributeGenerator,
  type: EquipmentTypeDefinition,
  level: TMapTier,
  seed: number,
): TokenAttribute[] {
  return generator.generate({
    level,
    group: type.group,
    type,
    tokenId: `test:${type.key}:${seed}`,
    rng: seededRandomStreams(`ea2-seed-${seed}`),
  });
}

export function seeds(count: number = SEEDS): number[] {
  return Array.from({ length: count }, (_, index) => index);
}
