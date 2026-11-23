import {
  attributeHintKey,
  attributeLabelKey,
  type EquipmentAttributeDefinition,
} from '../tokens/equipment/equipment-attribute-schema';
import { ITEM_GROUPS, type TAttributeFormat } from '../tokens/equipment/equipment-keys';

type AttributeFields = Omit<EquipmentAttributeDefinition, 'key' | 'display' | 'implemented'> & {
  icon: string;
  format: TAttributeFormat;
  implemented?: boolean;
};

function attribute<K extends string>(
  key: K,
  fields: AttributeFields,
): EquipmentAttributeDefinition & { key: K } {
  const { icon, format, implemented = false, ...rest } = fields;
  return {
    key,
    ...rest,
    implemented,
    display: { labelKey: attributeLabelKey(key), hintKey: attributeHintKey(key), icon, format },
  };
}

function blocked<K extends string>(
  key: K,
  groups: EquipmentAttributeDefinition['groups'],
  icon: string,
): EquipmentAttributeDefinition & { key: K } {
  return attribute(key, {
    groups,
    stat: null,
    aggregate: 'sum',
    scope: 'hero',
    icon,
    format: 'plain',
  });
}

const HERO_SUM = { aggregate: 'sum', scope: 'hero' } as const;
const ITEM_SUM = { aggregate: 'sum', scope: 'item' } as const;

const DEFINITIONS = [
  attribute('heart', {
    groups: ['defense', 'clothing'],
    stat: 'maxHearts',
    ...HERO_SUM,
    itemMax: 10,
    totalCap: 10,
    icon: 'heart',
    format: 'hearts',
    implemented: true,
  }),
  attribute('shield', {
    groups: ['defense'],
    onlyTypes: ['shield'],
    implemented: true,
    stat: 'blockSides',
    ...HERO_SUM,
    itemMax: 5,
    totalCap: 6,
    icon: 'shield',
    format: 'plus',
  }),
  attribute('will', {
    groups: [...ITEM_GROUPS],
    stat: 'maxWill',
    ...HERO_SUM,
    itemMax: 40,
    icon: 'flame',
    format: 'plus',
    implemented: true,
  }),
  attribute('fog', {
    groups: ['clothing'],
    onlyTypes: ['helm'],
    stat: 'fogRadius',
    ...HERO_SUM,
    itemMax: 2,
    totalCap: 2,
    icon: 'sun',
    format: 'plus',
    implemented: true,
  }),
  attribute('force', {
    groups: ['weapon'],
    stat: 'strikeForce',
    ...HERO_SUM,
    icon: 'anvil',
    format: 'plus',
  }),
  attribute('mass', {
    groups: ['clothing'],
    stat: 'pushMass',
    ...HERO_SUM,
    icon: 'rock',
    format: 'plus',
  }),
  attribute('bag', {
    groups: ['burden'],
    stat: 'carryKg',
    ...HERO_SUM,
    icon: 'weight',
    format: 'plus',
  }),
  attribute('crit-chance', {
    groups: ['weapon'],
    excludes: { tool: true },
    stat: 'critPoints',
    ...ITEM_SUM,
    itemMax: 10,
    totalCap: 10,
    icon: 'bolt',
    format: 'pct',
    implemented: true,
  }),
  attribute('crit-dmg', {
    groups: ['weapon'],
    excludes: { tool: true },
    requires: { attributes: ['crit-chance'] },
    stat: 'critDamage',
    aggregate: 'max',
    scope: 'item',
    itemMax: 5,
    totalCap: 5,
    icon: 'drop',
    format: 'multiplier',
    implemented: true,
  }),
  attribute('trophy', {
    groups: ['weapon'],
    excludes: { tool: true },
    stat: 'graveLootBonus',
    ...ITEM_SUM,
    itemMax: 2,
    totalCap: 2,
    icon: 'skull',
    format: 'plus',
    implemented: true,
  }),
  attribute('yield', {
    groups: ['weapon'],
    requires: { tool: true },
    stat: 'harvestBonus',
    ...ITEM_SUM,
    itemMax: 2,
    totalCap: 2,
    icon: 'stack',
    format: 'plus',
    implemented: true,
  }),
  attribute('heal-on-block', {
    groups: ['defense'],
    onlyTypes: ['shield'],
    stat: 'healOnBlock',
    ...ITEM_SUM,
    itemMax: 4,
    totalCap: 4,
    icon: 'heart',
    format: 'hearts',
    implemented: true,
  }),
  attribute('thorns', {
    groups: ['defense'],
    stat: 'thorns',
    ...HERO_SUM,
    itemMax: 2,
    totalCap: 2,
    icon: 'star',
    format: 'hearts',
  }),
  attribute('absorb', {
    groups: ['clothing'],
    onlyTypes: ['armor', 'helm'],
    stat: 'absorb',
    aggregate: 'max',
    scope: 'hero',
    itemMax: 1,
    totalCap: 1,
    icon: 'ward',
    format: 'hearts',
  }),
  attribute('hero-crit', {
    groups: ['clothing'],
    onlyTypes: ['gloves'],
    stat: 'heroCritPoints',
    ...HERO_SUM,
    itemMax: 25,
    totalCap: 25,
    icon: 'target',
    format: 'pct',
  }),
  attribute('smart-step', {
    groups: ['clothing'],
    onlyTypes: ['boots'],
    stat: 'stepFreeEvery',
    aggregate: 'min',
    scope: 'hero',
    icon: 'boots',
    format: 'plain',
    implemented: true,
  }),
  attribute('deft-hands', {
    groups: ['clothing'],
    onlyTypes: ['gloves'],
    stat: 'useWillDiscount',
    ...HERO_SUM,
    itemMax: 2,
    totalCap: 2,
    icon: 'gloves',
    format: 'minus',
    implemented: true,
  }),
  attribute('trade', {
    groups: ['jewelry'],
    onlyTypes: ['ring'],
    stat: 'shopBuyDiscountPct',
    ...HERO_SUM,
    itemMax: 10,
    totalCap: 10,
    icon: 'coins',
    format: 'pct',
  }),
  attribute('wisdom', {
    groups: ['jewelry'],
    onlyTypes: ['amulet'],
    stat: 'answerWillReward',
    ...HERO_SUM,
    itemMax: 5,
    totalCap: 5,
    icon: 'book',
    format: 'plus',
    implemented: true,
  }),
  blocked('initiative', ['weapon', 'jewelry'], 'feather'),
  blocked('sweep', ['weapon'], 'spiral'),
  blocked('feint', ['weapon'], 'wings'),
  blocked('knockback', ['weapon'], 'horns'),
  blocked('crit-power', ['weapon'], 'bolt'),
  blocked('damage-plus', ['weapon'], 'sword'),
  blocked('damage-mul', ['weapon'], 'sword'),
  blocked('defense-plus', ['defense'], 'shield'),
  blocked('counter', ['defense'], 'cross'),
  blocked('steadfast', ['defense'], 'tower'),
  blocked('rest', ['clothing'], 'moon'),
] as const;

export type EquipmentAttributeKey = (typeof DEFINITIONS)[number]['key'];

export const EQUIPMENT_ATTRIBUTES: readonly EquipmentAttributeDefinition[] = DEFINITIONS;
