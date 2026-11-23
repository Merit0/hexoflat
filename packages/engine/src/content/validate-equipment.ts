import type { z } from 'zod';
import { adjectiveSchema, type Adjective } from '../tokens/equipment/adjective-schema';
import {
  attributeProfilesSchema,
  type AttributeProfiles,
} from '../tokens/equipment/attribute-profile-schema';
import {
  adjectivesFor as adjectivesForRule,
  bandFailures,
  blockSidesFailures,
  itemMaxFailures,
  dependencyFailures,
  profileEntryFailures,
  statRuleFailures,
  unprofiledAttributeFailures,
  unreachableWeightFailures,
  type AdjectiveTargetType,
} from '../tokens/equipment/equipment-content-rules';
import { PRICE_BANDS } from '../tokens/factory/price-generator';
import {
  equipmentAttributeDefinitionSchema,
  type EquipmentAttributeDefinition,
} from '../tokens/equipment/equipment-attribute-schema';
import { ADJECTIVE_BANDS, type TAdjectiveBand } from '../tokens/equipment/equipment-keys';
import {
  equipmentTypeDefinitionSchema,
  type EquipmentTypeDefinition,
} from '../tokens/equipment/equipment-type-schema';
import { ATTRIBUTE_PROFILES } from './attribute-profiles.content';
import { EQUIPMENT_ATTRIBUTES } from './equipment-attributes.content';
import { EQUIPMENT_TYPES } from './item-types.content';
import { TOKEN_ADJECTIVES } from './token-adjectives.content';
import { TOKEN_CONTENT } from './token-content';

export const MIN_ADJECTIVES_PER_BAND = 3;

export interface EquipmentContent {
  types: readonly EquipmentTypeDefinition[];
  attributes: readonly EquipmentAttributeDefinition[];
  profiles: AttributeProfiles;
  adjectives: readonly Adjective[];
  tokenTypeKeys: readonly string[];
}

export const EQUIPMENT_CONTENT: EquipmentContent = {
  types: EQUIPMENT_TYPES,
  attributes: EQUIPMENT_ATTRIBUTES,
  profiles: ATTRIBUTE_PROFILES,
  adjectives: TOKEN_ADJECTIVES,
  tokenTypeKeys: TOKEN_CONTENT.types.map((type) => type.key),
};

function repeatedKeys(entries: readonly { key: string }[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const { key } of entries) {
    if (seen.has(key)) repeated.add(key);
    seen.add(key);
  }
  return [...repeated];
}

function parseFailures(kind: string, entries: readonly unknown[], schema: z.ZodType): string[] {
  return entries.flatMap((entry, index) => {
    const parsed = schema.safeParse(entry);
    return parsed.success ? [] : [`${kind} #${index}: ${parsed.error.message}`];
  });
}

function typeFailures(content: EquipmentContent): string[] {
  const failures = parseFailures('type', content.types, equipmentTypeDefinitionSchema);
  failures.push(...repeatedKeys(content.types).map((key) => `type ${key} is listed twice`));
  const enabled = content.types.filter((type) => type.enabled).map((type) => type.key);
  const tokenTypes = new Set(content.tokenTypeKeys);
  for (const key of enabled) {
    if (!tokenTypes.has(key)) failures.push(`enabled type ${key} is not a token type`);
  }
  for (const key of tokenTypes) {
    if (!enabled.includes(key)) failures.push(`token type ${key} is not an enabled type`);
  }
  return failures;
}

function attributeTypeFailures(
  attribute: EquipmentAttributeDefinition,
  types: ReadonlyMap<string, EquipmentTypeDefinition>,
): string[] {
  const failures: string[] = [];
  for (const key of attribute.onlyTypes ?? []) {
    const type = types.get(key);
    if (!type) failures.push(`attribute ${attribute.key} names unknown type ${key}`);
    else if (!attribute.groups.includes(type.group)) {
      failures.push(`attribute ${attribute.key} names type ${key} outside its groups`);
    }
  }
  if (attribute.requires?.tool) {
    const tools = [...types.values()].filter(
      (type) => type.tool !== null && attribute.groups.includes(type.group),
    );
    if (tools.length === 0) failures.push(`attribute ${attribute.key} needs a tool no type has`);
  }
  if (attribute.excludes?.tool) {
    const others = [...types.values()].filter(
      (type) => type.tool === null && attribute.groups.includes(type.group),
    );
    if (others.length === 0) {
      failures.push(
        `attribute ${attribute.key} excludes tools, but no other type is in its groups`,
      );
    }
  }
  return failures;
}

function attributeFailures(content: EquipmentContent): string[] {
  const failures = parseFailures(
    'attribute',
    content.attributes,
    equipmentAttributeDefinitionSchema,
  );
  failures.push(
    ...repeatedKeys(content.attributes).map((key) => `attribute ${key} is listed twice`),
  );
  const types = new Map(content.types.map((type) => [type.key, type] as const));
  for (const attribute of content.attributes) {
    failures.push(...attributeTypeFailures(attribute, types));
  }
  return failures;
}

function profileFailures(content: EquipmentContent): string[] {
  const parsed = attributeProfilesSchema.safeParse(content.profiles);
  if (!parsed.success) return [`profiles: ${parsed.error.message}`];
  return [
    ...profileEntryFailures(parsed.data, content.attributes),
    ...unreachableWeightFailures(parsed.data, content.attributes, content.types),
    ...unprofiledAttributeFailures(parsed.data, content.attributes),
    ...dependencyFailures(parsed.data, content.attributes, content.types),
    ...bandFailures(parsed.data, Math.min(ADJECTIVE_BANDS.length, PRICE_BANDS)),
  ];
}

export function adjectivesFor(
  type: AdjectiveTargetType,
  band: TAdjectiveBand,
  adjectives: readonly Adjective[] = TOKEN_ADJECTIVES,
): Adjective[] {
  return adjectivesForRule(type, band, adjectives);
}

function adjectiveFailures(content: EquipmentContent): string[] {
  const failures = parseFailures('adjective', content.adjectives, adjectiveSchema);
  failures.push(
    ...repeatedKeys(content.adjectives).map((key) => `adjective ${key} is listed twice`),
  );
  for (const type of content.types.filter((candidate) => candidate.tool === null)) {
    for (const band of ADJECTIVE_BANDS) {
      const count = adjectivesFor(type, band, content.adjectives).length;
      if (count < MIN_ADJECTIVES_PER_BAND) {
        failures.push(
          `${type.key} has ${count} ${band} adjectives, needs ${MIN_ADJECTIVES_PER_BAND}`,
        );
      }
    }
  }
  return failures;
}

export function equipmentContentFailures(content: EquipmentContent = EQUIPMENT_CONTENT): string[] {
  return [
    ...typeFailures(content),
    ...attributeFailures(content),
    ...statRuleFailures(content.attributes),
    ...blockSidesFailures(content.types),
    ...itemMaxFailures(content.attributes),
    ...profileFailures(content),
    ...adjectiveFailures(content),
  ];
}

export function equipmentLocaleKeys(
  attributes: readonly EquipmentAttributeDefinition[] = EQUIPMENT_ATTRIBUTES,
): string[] {
  return attributes.flatMap((attribute) => [attribute.display.labelKey, attribute.display.hintKey]);
}
