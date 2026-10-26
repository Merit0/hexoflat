import {
  EEquipmentRarity,
  EHexobjectGroup,
  type THexobjectPrototype,
  type TEquipSlot,
} from '../../abstraction/hexobject-abstraction';
import { getMeta, getPrototype } from '../../content';
import { getShieldPoints } from '../../combat/shield-points';
import { getHeartPoints } from '../../combat/heart-points';
import {
  getToolCapabilities,
  type ToolCapabilities,
} from '../../game-resolvers/interactions-resolver';
import type { THeroToolKey } from '../../content/equipment.content';
import type { THexobjectKey } from '../../registry/hexobjects-registry';
import { EHexActionType } from '../../enums/hex-action-type';
import { HEXOBJECT_KEYS } from '../../registry/hexobjects-registry';
import type { SkillId } from '../../skills/skill-content';
import {
  getPortalAbility,
  getPortalBaseCost,
  getPortalSkillId,
  type SkillRanks,
} from '../../skills/skill-rules';
import { resolveInventoryView } from './traits-resolver';

export type TooltipCapability =
  'cut' | 'mine' | 'pickup' | 'enter' | 'use' | 'open' | 'attack' | 'block';
export type TooltipHeadlineKind = 'damage' | 'defense' | 'multiplier';
export type TooltipDirection = 'better' | 'worse' | 'same';

export interface TooltipComparison {
  direction: TooltipDirection;
  delta: number;
}

export interface TooltipHeadline {
  kind: TooltipHeadlineKind;
  min: number;
  max: number;
  comparison?: TooltipComparison;
}

export interface TooltipFooter {
  weightKg: number;
  durabilityMax?: number;
  stack?: { amount: number; max?: number };
}

export type TooltipWillUse = { kind: 'cost' | 'locked'; will: number; skillId?: SkillId };

export interface ItemTooltipView {
  key: THexobjectKey;
  title: string;
  subtitle?: string;
  description?: string;
  group: EHexobjectGroup;
  rarity: EEquipmentRarity;
  equipSlot?: TEquipSlot;
  equipped: boolean;
  headline?: TooltipHeadline;
  capabilities: TooltipCapability[];
  use?: TooltipWillUse;
  shields: number;
  hearts: number;
  footer: TooltipFooter;
}

export interface ItemTooltipOptions {
  equipped?: boolean;
  compareWith?: THexobjectKey;
  amount?: number;
  skills?: SkillRanks;
}

const CAPABILITY_BY_FLAG: Array<[keyof ToolCapabilities, TooltipCapability]> = [
  ['canCut', 'cut'],
  ['canMine', 'mine'],
  ['canPickup', 'pickup'],
  ['canEnter', 'enter'],
  ['canUse', 'use'],
  ['canOpen', 'open'],
  ['canAttack', 'attack'],
  ['canBlock', 'block'],
];

function rarityOf(proto: THexobjectPrototype): EEquipmentRarity {
  switch (proto.groupType) {
    case EHexobjectGroup.TOOL:
      return proto.tool.rarity ?? EEquipmentRarity.COMMON;
    case EHexobjectGroup.EQUIPMENT:
      return proto.equipment.rarity ?? EEquipmentRarity.COMMON;
    case EHexobjectGroup.LOOT:
      return proto.loot.rarity ?? EEquipmentRarity.BASIC;
    default:
      return EEquipmentRarity.BASIC;
  }
}

function headlineOf(proto: THexobjectPrototype): TooltipHeadline | undefined {
  if (proto.groupType === EHexobjectGroup.EQUIPMENT && proto.weapon) {
    return { kind: 'damage', min: proto.weapon.damageMin, max: proto.weapon.damageMax };
  }
  const defense =
    proto.groupType === EHexobjectGroup.EQUIPMENT
      ? proto.equipment.defense
      : proto.groupType === EHexobjectGroup.TOOL
        ? proto.tool.defense
        : undefined;
  if (defense !== undefined) return { kind: 'defense', min: defense, max: defense };
  if (proto.groupType === EHexobjectGroup.TOOL && proto.tool.attackMultiplier !== undefined) {
    const value = proto.tool.attackMultiplier;
    return { kind: 'multiplier', min: value, max: value };
  }
  return undefined;
}

function headlineValue(headline: TooltipHeadline): number {
  return (headline.min + headline.max) / 2;
}

function compareHeadlines(
  current: TooltipHeadline,
  other?: TooltipHeadline,
): TooltipComparison | undefined {
  if (!other || other.kind !== current.kind) return undefined;
  const delta = Math.round((headlineValue(current) - headlineValue(other)) * 100) / 100;
  return { direction: delta > 0 ? 'better' : delta < 0 ? 'worse' : 'same', delta };
}

function durabilityMaxOf(proto: THexobjectPrototype): number | undefined {
  if (proto.groupType === EHexobjectGroup.TOOL) return proto.tool.durabilityMax;
  if (proto.groupType === EHexobjectGroup.EQUIPMENT) return proto.equipment.durabilityMax;
  return undefined;
}

function capabilitiesOf(key: THexobjectKey, group: EHexobjectGroup): TooltipCapability[] {
  if (group !== EHexobjectGroup.TOOL && group !== EHexobjectGroup.EQUIPMENT) return [];
  const flags = getToolCapabilities(key as THeroToolKey);
  return CAPABILITY_BY_FLAG.filter(([flag]) => flags[flag]).map(([, name]) => name);
}

function useWillOf(key: THexobjectKey, skills: SkillRanks = {}): TooltipWillUse | undefined {
  if (key === HEXOBJECT_KEYS.RETURN_SCROLL) {
    const portal = getPortalAbility(skills);
    const skillId = getPortalSkillId() ?? undefined;
    if (portal.unlocked) return { kind: 'cost', will: portal.willCost, skillId };
    return { kind: 'locked', will: getPortalBaseCost() ?? 0, skillId };
  }
  const cost = getMeta(key)?.actions?.[EHexActionType.USE]?.willCost ?? 0;
  return cost > 0 ? { kind: 'cost', will: cost } : undefined;
}

export function resolveItemTooltip(
  key: THexobjectKey,
  options: ItemTooltipOptions = {},
): ItemTooltipView {
  const proto = getPrototype(key);
  const view = resolveInventoryView(key);
  const meta = getMeta(key);

  const headline = headlineOf(proto);
  if (headline && options.compareWith && options.compareWith !== key) {
    headline.comparison = compareHeadlines(headline, headlineOf(getPrototype(options.compareWith)));
  }

  return {
    key,
    title: view.title,
    subtitle: meta?.subtitle,
    description: proto.description,
    group: view.group,
    rarity: rarityOf(proto),
    equipSlot: view.equipSlot,
    equipped: options.equipped ?? false,
    headline,
    capabilities: capabilitiesOf(key, view.group),
    use: useWillOf(key, options.skills),
    shields: getShieldPoints(key),
    hearts: getHeartPoints(key),
    footer: {
      weightKg: view.weightKg,
      durabilityMax: durabilityMaxOf(proto),
      stack: view.stackable
        ? { amount: options.amount ?? 1, max: meta?.traits?.maxStack }
        : undefined,
    },
  };
}
