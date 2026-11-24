import { UNIQUE_ATTRIBUTE_MULTIPLIER } from '../content/unique-rules.content';
import type { EquipmentAttributeDefinition } from './equipment/equipment-attribute-schema';
import {
  attributeProfilesSchema,
  type AttributeProfiles,
  type ProfileAttribute,
} from './equipment/attribute-profile-schema';

type BoundRules = Pick<EquipmentAttributeDefinition, 'aggregate' | 'itemMax' | 'totalCap'>;

function scaledValue(value: number, rules: BoundRules | undefined, multiplier: number): number {
  if (rules?.aggregate === 'min') return Math.max(1, Math.round(value / multiplier));
  const limit = Math.min(rules?.itemMax ?? Infinity, rules?.totalCap ?? Infinity);
  return Math.min(Math.round(value * multiplier), limit);
}

export function uniqueBounds(
  entry: ProfileAttribute,
  rules: BoundRules | undefined,
  multiplier: number,
): ProfileAttribute {
  const min = scaledValue(entry.min, rules, multiplier);
  const max = scaledValue(entry.max, rules, multiplier);
  return { ...entry, min, max: max - ((max - min) % entry.step) };
}

export function uniqueAttributeProfiles(
  profiles: AttributeProfiles,
  attributes: readonly EquipmentAttributeDefinition[],
  multiplier: number = UNIQUE_ATTRIBUTE_MULTIPLIER,
): AttributeProfiles {
  const known = new Map(attributes.map((attribute) => [attribute.key, attribute] as const));
  return attributeProfilesSchema.parse(
    Object.fromEntries(
      Object.entries(profiles).map(([tier, profile]) => [
        tier,
        {
          ...profile,
          attributes: Object.fromEntries(
            Object.entries(profile.attributes).map(([key, entry]) => [
              key,
              uniqueBounds(entry, known.get(key), multiplier),
            ]),
          ),
        },
      ]),
    ),
  );
}
