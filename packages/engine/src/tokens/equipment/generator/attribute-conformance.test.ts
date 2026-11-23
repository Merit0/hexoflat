import { describe, expect, it } from 'vitest';
import { battleItemOfHexobject } from '../../../battle/battle-catalogue';
import { ATTRIBUTE_PROFILES } from '../../../content/attribute-profiles.content';
import { EQUIPMENT_ATTRIBUTES } from '../../../content/equipment-attributes.content';
import { EQUIPMENT_TYPES, ITEM_TYPES } from '../../../content/item-types.content';
import { attributeFailure } from '../../attribute-rules';
import { contextFor, defaultFactory } from '../../factory/factory-test-setup';
import { AttributeRegistry } from '../../registries';
import { MAP_TIERS, type TMapTier } from '../../token-keys';
import type { ItemToken, TokenAttribute } from '../../token-schema';
import { sampleToken } from '../../token-test-setup';
import type { EquipmentAttributeDefinition } from '../equipment-attribute-schema';
import { attributeGeneratable } from '../equipment-content-rules';
import type { THeroStat } from '../equipment-keys';
import type { EquipmentTypeDefinition } from '../equipment-type-schema';
import { resolveHeroStats } from '../hero-stats';
import { resolveItemStats } from '../item-stats';
import { createEquipmentAttributeGenerator } from './create-equipment-attribute-generator';
import { rollFor } from './generator-test-setup';
import { RegistryAttributePoolFilter } from './pool-filter';

const SAMPLE_SEEDS = 1000;
const DEPRECATED_SEEDS = 300;

type Reach = 'inventory' | 'battle' | 'tool';

const STAT_READS: Partial<Record<THeroStat, Reach>> = {
  maxHearts: 'inventory',
  maxWill: 'inventory',
  fogRadius: 'inventory',
  stepFreeEvery: 'inventory',
  answerWillReward: 'inventory',
  useWillDiscount: 'battle',
  blockSides: 'battle',
  critPoints: 'battle',
  critDamage: 'battle',
  graveLootBonus: 'battle',
  healOnBlock: 'battle',
  harvestBonus: 'tool',
};

const HAND_SLOTS: readonly string[] = ['weapon', 'shield', 'any'];

const registry = new AttributeRegistry(EQUIPMENT_ATTRIBUTES);
const pool = new RegistryAttributePoolFilter(new AttributeRegistry(EQUIPMENT_ATTRIBUTES));
const generator = createEquipmentAttributeGenerator(
  new AttributeRegistry(EQUIPMENT_ATTRIBUTES),
  ATTRIBUTE_PROFILES,
);
const rolled = EQUIPMENT_ATTRIBUTES.filter(
  (attribute) => attribute.implemented && attribute.deprecated !== true,
);

function entryOf(key: string, tier: TMapTier) {
  return ATTRIBUTE_PROFILES[`tier-${tier}`].attributes[key];
}

function eligible(
  attribute: EquipmentAttributeDefinition,
  type: EquipmentTypeDefinition,
  tier: TMapTier,
): boolean {
  return (
    attributeGeneratable(attribute, type) &&
    entryOf(attribute.key, tier)?.weight[type.group] !== undefined
  );
}

function allowedValues(key: string, tier: TMapTier): number[] {
  const { min, max, step } = entryOf(key, tier);
  return Array.from({ length: (max - min) / step + 1 }, (_, index) => min + index * step);
}

function reaches(type: EquipmentTypeDefinition, reach: Reach): boolean {
  if (reach === 'tool') return type.tool !== null;
  if (reach === 'battle')
    return !HAND_SLOTS.includes(type.slot) || !!battleItemOfHexobject(type.key);
  return true;
}

function statOf(
  attribute: EquipmentAttributeDefinition,
  type: EquipmentTypeDefinition,
  token: ItemToken,
  attributes: readonly EquipmentAttributeDefinition[] = EQUIPMENT_ATTRIBUTES,
): number {
  const stat = attribute.stat!;
  const cell = { key: type.key, token };
  if (attribute.scope === 'item') return resolveItemStats(cell, attributes)[stat];
  const plain = { key: type.key, token: { ...token, attributes: [] } };
  const types = EQUIPMENT_TYPES;
  return (
    resolveHeroStats([cell], { attributes, types })[stat] -
    resolveHeroStats([plain], { attributes, types })[stat]
  );
}

function ownedToken(type: EquipmentTypeDefinition, attributes: TokenAttribute[]): ItemToken {
  return sampleToken({ type: type.key, name: { kind: 'noun', noun: type.key }, attributes });
}

const cases = EQUIPMENT_TYPES.flatMap((type) =>
  MAP_TIERS.map((tier) => [type.key, tier, type] as const),
);

describe('AG2 eligibility: pool = validator = content rule', () => {
  it.each(cases)('%s tier %s', (_key, tier, type) => {
    const profile = ATTRIBUTE_PROFILES[`tier-${tier}`];
    const pooled = new Set(
      pool.poolFor({ profile, group: type.group, type }).map((entry) => entry.key),
    );
    for (const attribute of EQUIPMENT_ATTRIBUTES) {
      const expected = eligible(attribute, type, tier);
      expect(pooled.has(attribute.key), attribute.key).toBe(expected);
      const value = entryOf(attribute.key, tier)?.min ?? 1;
      const failure = attributeFailure(
        registry,
        type,
        { key: attribute.key, value },
        { origin: 'base', profiles: ATTRIBUTE_PROFILES },
        tier,
      );
      expect(failure === null, `${attribute.key}: ${failure}`).toBe(expected);
    }
  });
});

describe('AG2 rolled values', () => {
  it.each(cases)(
    '%s tier %s rolls every allowed value, nothing else, with its requirements',
    (_key, tier, type) => {
      const seen = new Map<string, Set<number>>();
      for (let seed = 0; seed < SAMPLE_SEEDS; seed++) {
        const attributes = rollFor(generator, type, tier, seed);
        const keys = attributes.map((entry) => entry.key);
        for (const { key, value } of attributes) {
          seen.set(key, (seen.get(key) ?? new Set()).add(value));
          const needs = EQUIPMENT_ATTRIBUTES.find((entry) => entry.key === key)?.requires
            ?.attributes;
          for (const requiredKey of needs ?? []) expect(keys, key).toContain(requiredKey);
        }
      }
      for (const attribute of EQUIPMENT_ATTRIBUTES) {
        const values = [...(seen.get(attribute.key) ?? [])].sort((a, b) => a - b);
        const expected = eligible(attribute, type, tier) ? allowedValues(attribute.key, tier) : [];
        expect(values, attribute.key).toEqual(expected);
      }
    },
  );
});

describe('AG2 factory overrides', () => {
  const tokenCases = ITEM_TYPES.flatMap((type) =>
    MAP_TIERS.map((tier) => [type.key, tier] as const),
  );

  it.each(tokenCases)('%s tier %s accepts the range, refuses the rest', (key, tier) => {
    const type = EQUIPMENT_TYPES.find((candidate) => candidate.key === key)!;
    const context = contextFor(1, { type: key, mapTier: tier });
    for (const attribute of rolled) {
      const required = (attribute.requires?.attributes ?? []).map((requiredKey) => ({
        key: requiredKey,
        value: entryOf(requiredKey, tier)?.min ?? 1,
      }));
      const make = (entry: TokenAttribute) =>
        defaultFactory.createBase(context, { attributes: [...required, entry] });
      if (!eligible(attribute, type, tier)) {
        const value = entryOf(attribute.key, tier)?.min ?? 1;
        expect(make({ key: attribute.key, value }).ok, attribute.key).toBe(false);
        continue;
      }
      const { min, max } = entryOf(attribute.key, tier);
      for (const value of [min, max]) {
        const made = make({ key: attribute.key, value });
        if (!made.ok) throw new Error(`${attribute.key} ${value}: ${made.refusal.message}`);
        expect(statOf(attribute, type, made.value), `${attribute.key} ${value}`).toBe(value);
      }
      for (const value of [min - 1, max + 1].filter((candidate) => candidate >= 1)) {
        expect(make({ key: attribute.key, value }).ok, `${attribute.key} ${value}`).toBe(false);
      }
      if (required.length > 0) {
        const alone = defaultFactory.createBase(context, {
          attributes: [{ key: attribute.key, value: min }],
        });
        expect(
          alone.ok,
          `${attribute.key} without ${required.map((entry) => entry.key).join(', ')}`,
        ).toBe(false);
      }
    }
  });
});

describe('AG2 deprecated attributes', () => {
  it.each(rolled.map((attribute) => [attribute.key, attribute] as const))(
    '%s stops rolling and keeps its effect on owned tokens',
    (_key, attribute) => {
      const attributes = EQUIPMENT_ATTRIBUTES.map((definition) =>
        definition.key === attribute.key ? { ...definition, deprecated: true } : definition,
      );
      const deprecated = createEquipmentAttributeGenerator(
        new AttributeRegistry(attributes),
        ATTRIBUTE_PROFILES,
      );
      const type = EQUIPMENT_TYPES.find((candidate) => eligible(attribute, candidate, 4))!;
      for (let seed = 0; seed < DEPRECATED_SEEDS; seed++) {
        const keys = rollFor(deprecated, type, 4, seed).map((entry) => entry.key);
        expect(keys).not.toContain(attribute.key);
      }
      const value = entryOf(attribute.key, 4).min;
      const token = ownedToken(type, [{ key: attribute.key, value }]);
      expect(statOf(attribute, type, token, attributes)).toBe(value);
    },
  );
});

describe('AG2 readers', () => {
  it('declares where every implemented stat is read', () => {
    for (const attribute of EQUIPMENT_ATTRIBUTES.filter((entry) => entry.implemented)) {
      expect(STAT_READS[attribute.stat!], attribute.key).toBeDefined();
    }
  });

  it('rolls no attribute on a type its reader never sees', () => {
    const dead = rolled.flatMap((attribute) =>
      EQUIPMENT_TYPES.filter(
        (type) =>
          MAP_TIERS.some((tier) => eligible(attribute, type, tier)) &&
          !reaches(type, STAT_READS[attribute.stat!]!),
      ).map((type) => `${attribute.key}:${type.key}`),
    );
    expect(dead).toEqual([]);
  });
});
