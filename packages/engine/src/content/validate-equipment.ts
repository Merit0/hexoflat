import type { z } from 'zod';
import {
  adjectiveFits,
  adjectiveSchema,
  type Adjective,
} from '../tokens/equipment/adjective-schema';
import {
  attributeProfilesSchema,
  type AttributeProfiles,
} from '../tokens/equipment/attribute-profile-schema';
import {
  equipmentAttributeDefinitionSchema,
  type EquipmentAttributeDefinition,
} from '../tokens/equipment/equipment-attribute-schema';
import {
  ADJECTIVE_BANDS,
  ATTRIBUTE_PROFILE_TIERS,
  type TAdjectiveBand,
  type TItemGroup,
} from '../tokens/equipment/equipment-keys';
import {
  equipmentTypeDefinitionSchema,
  type EquipmentTypeDefinition,
} from '../tokens/equipment/equipment-type-schema';
import type { AttributeDefinition } from '../tokens/token-content-schema';
import type { TMapTier } from '../tokens/token-keys';
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
  tokenAttributes: readonly AttributeDefinition[];
  tokenTypeKeys: readonly string[];
}

export const EQUIPMENT_CONTENT: EquipmentContent = {
  types: EQUIPMENT_TYPES,
  attributes: EQUIPMENT_ATTRIBUTES,
  profiles: ATTRIBUTE_PROFILES,
  adjectives: TOKEN_ADJECTIVES,
  tokenAttributes: TOKEN_CONTENT.attributes,
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
  const byKey = new Map(content.attributes.map((attribute) => [attribute.key, attribute] as const));
  for (const legacy of content.tokenAttributes) {
    const attribute = byKey.get(legacy.key);
    if (!attribute) failures.push(`token attribute ${legacy.key} is not an equipment attribute`);
    else if (attribute.implemented !== legacy.implemented) {
      failures.push(`attribute ${legacy.key} is implemented in one registry only`);
    }
  }
  return failures;
}

function profileEntryFailures(
  tier: (typeof ATTRIBUTE_PROFILE_TIERS)[number],
  key: string,
  entry: AttributeProfiles['tier-1']['attributes'][string],
  content: EquipmentContent,
): string[] {
  const attribute = content.attributes.find((candidate) => candidate.key === key);
  if (!attribute) return [`${tier}: attribute ${key} is unknown`];
  const failures: string[] = [];
  if (attribute.stat === null) failures.push(`${tier}: attribute ${key} is blocked`);
  for (const group of Object.keys(entry.weight) as TItemGroup[]) {
    if (!attribute.groups.includes(group)) {
      failures.push(`${tier}: attribute ${key} has a weight for group ${group}`);
    }
  }
  const legacy = content.tokenAttributes.find((candidate) => candidate.key === key);
  const mapTier = (ATTRIBUTE_PROFILE_TIERS.indexOf(tier) + 1) as TMapTier;
  if (legacy && entry.max > legacy.valueByTier[mapTier]) {
    failures.push(`${tier}: attribute ${key} max ${entry.max} is above its token ceiling`);
  }
  return failures;
}

function profileFailures(content: EquipmentContent): string[] {
  const parsed = attributeProfilesSchema.safeParse(content.profiles);
  if (!parsed.success) return [`profiles: ${parsed.error.message}`];
  return ATTRIBUTE_PROFILE_TIERS.flatMap((tier) =>
    Object.entries(parsed.data[tier].attributes).flatMap(([key, entry]) =>
      profileEntryFailures(tier, key, entry, content),
    ),
  );
}

export function adjectivesFor(
  type: Pick<EquipmentTypeDefinition, 'group' | 'materials'>,
  band: TAdjectiveBand,
  adjectives: readonly Adjective[] = TOKEN_ADJECTIVES,
): Adjective[] {
  return adjectives.filter(
    (adjective) => adjective.band === band && adjectiveFits(adjective, type),
  );
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
    ...profileFailures(content),
    ...adjectiveFailures(content),
  ];
}

export function equipmentLocaleKeys(
  attributes: readonly EquipmentAttributeDefinition[] = EQUIPMENT_ATTRIBUTES,
): string[] {
  return attributes.flatMap((attribute) => [attribute.display.labelKey, attribute.display.hintKey]);
}
