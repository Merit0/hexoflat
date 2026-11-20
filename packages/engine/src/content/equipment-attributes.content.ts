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

function attribute(key: string, fields: AttributeFields): EquipmentAttributeDefinition {
  const { icon, format, implemented = false, ...rest } = fields;
  return {
    key,
    ...rest,
    implemented,
    display: { labelKey: attributeLabelKey(key), hintKey: attributeHintKey(key), icon, format },
  };
}

function blocked(
  key: string,
  groups: EquipmentAttributeDefinition['groups'],
  icon: string,
): EquipmentAttributeDefinition {
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

export const EQUIPMENT_ATTRIBUTES: readonly EquipmentAttributeDefinition[] = [
  attribute('heart', {
    groups: ['defense', 'clothing'],
    stat: 'maxHearts',
    ...HERO_SUM,
    cap: 10,
    icon: 'heart',
    format: 'hearts',
    implemented: true,
  }),
  attribute('shield', {
    groups: ['defense'],
    stat: 'blockSides',
    ...HERO_SUM,
    cap: 6,
    icon: 'shield',
    format: 'plus',
  }),
  attribute('will', {
    groups: [...ITEM_GROUPS],
    stat: 'maxWill',
    ...HERO_SUM,
    icon: 'flame',
    format: 'plus',
    implemented: true,
  }),
  attribute('fog', {
    groups: ['clothing'],
    onlyTypes: ['helm'],
    stat: 'fogRadius',
    ...HERO_SUM,
    cap: 2,
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
  attribute('crit', {
    groups: ['weapon'],
    stat: 'critPoints',
    ...ITEM_SUM,
    cap: 25,
    icon: 'bolt',
    format: 'pct',
  }),
  attribute('crit-dmg', {
    groups: ['weapon'],
    stat: 'critDamage',
    ...ITEM_SUM,
    cap: 2,
    icon: 'drop',
    format: 'hearts',
  }),
  attribute('trophy', {
    groups: ['weapon'],
    stat: 'graveLootBonus',
    ...ITEM_SUM,
    cap: 2,
    icon: 'skull',
    format: 'plus',
  }),
  attribute('yield', {
    groups: ['weapon'],
    requires: { tool: true },
    stat: 'harvestBonus',
    ...ITEM_SUM,
    cap: 2,
    icon: 'stack',
    format: 'plus',
    implemented: true,
  }),
  attribute('thorns', {
    groups: ['defense'],
    stat: 'thorns',
    ...HERO_SUM,
    cap: 2,
    icon: 'star',
    format: 'hearts',
  }),
  attribute('absorb', {
    groups: ['clothing'],
    onlyTypes: ['armor', 'helm'],
    stat: 'absorb',
    aggregate: 'max',
    scope: 'hero',
    cap: 1,
    icon: 'ward',
    format: 'hearts',
  }),
  attribute('hero-crit', {
    groups: ['clothing'],
    onlyTypes: ['gloves'],
    stat: 'critPoints',
    ...HERO_SUM,
    cap: 25,
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
    cap: 2,
    icon: 'gloves',
    format: 'minus',
    implemented: true,
  }),
  attribute('trade', {
    groups: ['jewelry'],
    onlyTypes: ['ring'],
    stat: 'shopBuyDiscountPct',
    ...HERO_SUM,
    cap: 10,
    icon: 'coins',
    format: 'pct',
  }),
  attribute('focus', {
    groups: ['jewelry'],
    onlyTypes: ['amulet'],
    stat: 'answerWillReward',
    ...HERO_SUM,
    cap: 5,
    deprecated: true,
    icon: 'book',
    format: 'plus',
    implemented: true,
  }),
  attribute('wisdom', {
    groups: ['jewelry'],
    onlyTypes: ['amulet'],
    stat: 'answerWillReward',
    ...HERO_SUM,
    cap: 5,
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
];
