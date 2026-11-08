import { getMeta } from '@hexoflat/engine';
import { EHexActionType } from '@hexoflat/engine/enums/hex-action-type';
import {
  EChestType,
  ERarityKind,
  EHexobjectGroup,
  type THexobject,
} from '@hexoflat/engine/abstraction/hexobject-abstraction';
import type { TRarityTone } from '@hexoflat/engine/content/rarity-rules';
import { RARITY_COLOR, getObjectRarity, getObjectRarityTone } from '@/render/rarity';
import { ITEM_ICON_BY_KEY, type TIconName } from '@/components/gui/icons/item-icons';

export type HexInfoTranslate = (key: string, params?: Record<string, unknown>) => string;
export type HexInfoTagTone = 'neutral' | 'good' | 'warn' | 'danger';

export interface HexInfoTag {
  id: string;
  label: string;
  tone: HexInfoTagTone;
}

export interface HexInfoStat {
  id: string;
  label: string;
  value: string;
}

export interface HexInfoAction {
  id: string;
  label: string;
  will: number;
}

export interface HexInfoHearts {
  fills: number[];
  value: number;
  max: number;
}

export interface HexInfoSupply {
  label: string;
  value: number;
  max: number;
}

export interface HexInfoHeadline {
  value: string;
  label: string;
}

export interface HexInfoRarity {
  label: string;
  color: string;
  tone: TRarityTone;
}

export interface HexInfoEffect {
  label: string;
}

export type HexInfoVariant = 'creature' | 'resource' | 'construction' | 'weapon' | 'item';

export interface HexInfoView {
  variant: HexInfoVariant;
  key: string;
  title: string;
  kind: string;
  subtitle: string | null;
  description: string | null;
  accent: string;
  icon: TIconName | null;
  rarity: HexInfoRarity | null;
  hearts: HexInfoHearts | null;
  supply: HexInfoSupply | null;
  headline: HexInfoHeadline | null;
  locked: boolean;
  broken: boolean;
  effect: HexInfoEffect | null;
  tags: HexInfoTag[];
  stats: HexInfoStat[];
  actions: HexInfoAction[];
}

const MAX_HEART_ICONS = 10;

export function heartsFor(hp: number, hpMax: number): HexInfoHearts {
  const max = Math.max(1, hpMax);
  const count = Math.min(max, MAX_HEART_ICONS);
  const per = max / count;
  const fills = Array.from({ length: count }, (_, index) => {
    const raw = Math.min(1, Math.max(0, (hp - index * per) / per));
    const rounded = Math.round(raw * 2) / 2;
    return raw > 0 && rounded === 0 ? 0.5 : rounded;
  });
  return { fills, value: hp, max };
}

const GROUP_ACCENT: Record<EHexobjectGroup, string> = {
  [EHexobjectGroup.RESOURCE]: '#8fc46a',
  [EHexobjectGroup.CREATURE]: '#e0705c',
  [EHexobjectGroup.TOOL]: '#79b8dd',
  [EHexobjectGroup.CONSTRUCTION]: '#d1a35f',
  [EHexobjectGroup.LOOT]: '#e6c75a',
  [EHexobjectGroup.EQUIPMENT]: '#b78fe6',
};

function rarityLabel(ctx: Ctx, kind: ERarityKind): string {
  switch (kind) {
    case ERarityKind.GLOOM:
      return ctx.t('itemTooltip.rarity.gloom');
    case ERarityKind.SPARK:
      return ctx.t('itemTooltip.rarity.spark');
    case ERarityKind.GOD_EXECUTOR:
      return ctx.t('itemTooltip.rarity.god-executor');
    default:
      return ctx.t('itemTooltip.rarity.idol');
  }
}

const GROUP_ICON: Partial<Record<EHexobjectGroup, TIconName>> = {
  [EHexobjectGroup.CREATURE]: 'skull',
  [EHexobjectGroup.RESOURCE]: 'stack',
  [EHexobjectGroup.CONSTRUCTION]: 'tower',
};

const RESOURCE_ICON_BY_KEY: Partial<Record<string, TIconName>> = {
  tree: 'wood',
  mountain: 'rock',
};

const HIDDEN_ACTIONS: ReadonlySet<string> = new Set([EHexActionType.SCOUT]);

const FACTION_ACCENT = { friendly: '#5fd1b8', neutral: '#d9c27a', enemy: '#e0705c' } as const;

interface Ctx {
  t: HexInfoTranslate;
  te: (key: string) => boolean;
}

function localize(ctx: Ctx, key: string): string {
  return ctx.te(key) ? ctx.t(key) : key;
}

function stat(id: string, label: string, value: string | number): HexInfoStat {
  return { id, label, value: String(value) };
}

function tag(id: string, label: string, tone: HexInfoTagTone): HexInfoTag {
  return { id, label, tone };
}

function factionTag(ctx: Ctx, faction: 'neutral' | 'enemy' | 'friendly'): HexInfoTag {
  if (faction === 'enemy') return tag('hostile', ctx.t('hexInfo.tags.hostile'), 'danger');
  if (faction === 'friendly') return tag('friendly', ctx.t('hexInfo.tags.friendly'), 'good');
  return tag('neutral', ctx.t('hexInfo.tags.neutral'), 'neutral');
}

function chestStat(ctx: Ctx, chestType: EChestType): HexInfoStat {
  return chestType === EChestType.STASH
    ? stat('stash', ctx.t('hexInfo.stats.stash'), '•')
    : stat('loot', ctx.t('hexInfo.stats.loot'), '•');
}

interface Part {
  variant: HexInfoVariant;
  tags: HexInfoTag[];
  stats: HexInfoStat[];
  accent?: string;
  hearts?: HexInfoHearts;
  supply?: HexInfoSupply;
  headline?: HexInfoHeadline;
  locked?: boolean;
  broken?: boolean;
}

function creatureInfo(
  ctx: Ctx,
  obj: Extract<THexobject, { groupType: EHexobjectGroup.CREATURE }>,
): Part {
  const { creature } = obj;
  const faction = creature.faction ?? 'neutral';
  const tags: HexInfoTag[] = [factionTag(ctx, faction)];
  if (creature.squad?.boss) tags.push(tag('boss', ctx.t('hexInfo.tags.boss'), 'warn'));
  if (creature.squad?.watcher) tags.push(tag('watcher', ctx.t('hexInfo.tags.watcher'), 'warn'));
  const stats = [stat('attack', ctx.t('hexInfo.stats.attack'), creature.attack)];
  if (creature.squad) {
    stats.push(stat('squad', ctx.t('hexInfo.stats.squad'), creature.squad.members.length));
  }
  return {
    variant: 'creature',
    accent: FACTION_ACCENT[faction],
    tags,
    stats,
    hearts: heartsFor(creature.hp, creature.hpMax),
  };
}

function resourceInfo(
  ctx: Ctx,
  obj: Extract<THexobject, { groupType: EHexobjectGroup.RESOURCE }>,
): Part {
  const { resource } = obj;
  const tags: HexInfoTag[] = [];
  if (!resource.isAvailable) {
    tags.push(
      resource.regrowAt
        ? tag('regrowing', ctx.t('hexInfo.tags.regrowing'), 'warn')
        : tag('depleted', ctx.t('hexInfo.tags.depleted'), 'warn'),
    );
  }
  if (resource.requiredToolKey) {
    const tool = localize(ctx, getMeta(resource.requiredToolKey).title);
    tags.push(tag('needsTool', ctx.t('hexInfo.tags.needsTool', { tool }), 'neutral'));
  }
  const supply =
    resource.maxAmount > 1
      ? {
          label: ctx.t('hexInfo.stats.amount'),
          value: resource.isAvailable ? (resource.amount ?? resource.maxAmount) : 0,
          max: resource.maxAmount,
        }
      : undefined;
  return { variant: 'resource', tags, stats: [], supply };
}

function lootInfo(ctx: Ctx, obj: Extract<THexobject, { groupType: EHexobjectGroup.LOOT }>): Part {
  const { loot } = obj;
  const stats = [
    stat('weight', ctx.t('hexInfo.stats.weight'), `${loot.traits.weightKG} ${ctx.t('hexInfo.kg')}`),
  ];
  if (loot.amount && loot.amount > 1) {
    stats.unshift(stat('amount', ctx.t('hexInfo.stats.amount'), loot.amount));
  }
  return { variant: 'item', tags: [], stats };
}

function constructionInfo(
  ctx: Ctx,
  obj: Extract<THexobject, { groupType: EHexobjectGroup.CONSTRUCTION }>,
): Part {
  const { construction } = obj;
  const tags: HexInfoTag[] = [];
  if (construction.isLocked) tags.push(tag('locked', ctx.t('hexInfo.tags.locked'), 'warn'));
  const stats = construction.chestType ? [chestStat(ctx, construction.chestType)] : [];
  return {
    variant: 'construction',
    tags,
    stats,
    locked: !!construction.isLocked,
    broken: !!obj.isInteractable && construction.integrity <= 0,
  };
}

function weaponHeadline(
  ctx: Ctx,
  obj: Extract<THexobject, { groupType: EHexobjectGroup.TOOL | EHexobjectGroup.EQUIPMENT }>,
): HexInfoHeadline | undefined {
  if (obj.groupType === EHexobjectGroup.EQUIPMENT && obj.weapon) {
    const { damageMin, damageMax } = obj.weapon;
    return {
      value: damageMin === damageMax ? `${damageMax}` : `${damageMin}–${damageMax}`,
      label: ctx.t('hexInfo.stats.damage'),
    };
  }
  if (obj.groupType === EHexobjectGroup.TOOL && obj.tool.attackMultiplier) {
    return { value: `×${obj.tool.attackMultiplier}`, label: ctx.t('hexInfo.stats.damage') };
  }
  return undefined;
}

function gearInfo(
  ctx: Ctx,
  obj: Extract<THexobject, { groupType: EHexobjectGroup.TOOL | EHexobjectGroup.EQUIPMENT }>,
): Part {
  const body = obj.groupType === EHexobjectGroup.TOOL ? obj.tool : obj.equipment;
  const equipment = obj.groupType === EHexobjectGroup.EQUIPMENT ? obj.equipment : null;
  const headline = weaponHeadline(ctx, obj);
  const stats: HexInfoStat[] = [];
  if (obj.groupType === EHexobjectGroup.EQUIPMENT && obj.weapon?.radius) {
    stats.push(stat('radius', ctx.t('hexInfo.stats.radius'), obj.weapon.radius));
  }
  if (body.defense) stats.push(stat('defense', ctx.t('hexInfo.stats.defense'), body.defense));
  if (equipment?.shields) {
    stats.push(stat('shields', ctx.t('hexInfo.stats.shields'), `+${equipment.shields}`));
  }
  if (equipment?.hearts) {
    stats.push(stat('hearts', ctx.t('hexInfo.stats.hearts'), `+${equipment.hearts}`));
  }
  if (body.durabilityMax) {
    stats.push(stat('durability', ctx.t('hexInfo.stats.durability'), body.durabilityMax));
  }
  return { variant: headline ? 'weapon' : 'item', tags: [], stats, headline };
}

export function buildHexInfo(
  obj: THexobject,
  groupLabel: string,
  t: HexInfoTranslate,
  te: (key: string) => boolean,
): HexInfoView {
  const ctx: Ctx = { t, te };
  const meta = getMeta(obj.hexobjectKey);
  const tone = getObjectRarityTone(obj);
  let part: Part;

  switch (obj.groupType) {
    case EHexobjectGroup.CREATURE:
      part = creatureInfo(ctx, obj);
      break;
    case EHexobjectGroup.RESOURCE:
      part = resourceInfo(ctx, obj);
      break;
    case EHexobjectGroup.LOOT:
      part = lootInfo(ctx, obj);
      break;
    case EHexobjectGroup.CONSTRUCTION:
      part = constructionInfo(ctx, obj);
      break;
    default:
      part = gearInfo(ctx, obj);
  }
  const rarity = getObjectRarity(obj);
  const icon =
    ITEM_ICON_BY_KEY[obj.hexobjectKey] ??
    RESOURCE_ICON_BY_KEY[obj.hexobjectKey] ??
    (part.headline ? 'sword' : (GROUP_ICON[obj.groupType] ?? null));
  const accent = tone ? RARITY_COLOR[tone] : (part.accent ?? GROUP_ACCENT[obj.groupType]);

  const title =
    obj.groupType === EHexobjectGroup.CREATURE
      ? localize(ctx, obj.creature.name)
      : localize(ctx, meta.title);

  const actions: HexInfoAction[] = Object.entries(meta.actions ?? {})
    .filter(([id]) => !HIDDEN_ACTIONS.has(id))
    .map(([id, action]) => ({
      id,
      label: localize(ctx, action.label),
      will: action.willCost ?? 0,
    }));

  return {
    variant: part.variant,
    key: obj.hexobjectKey,
    title,
    kind: groupLabel,
    subtitle: meta.subtitle ? localize(ctx, meta.subtitle) : null,
    description: obj.description ? localize(ctx, obj.description) : null,
    accent,
    icon,
    rarity:
      rarity && tone
        ? { label: rarityLabel(ctx, rarity.kind), color: RARITY_COLOR[tone], tone }
        : null,
    hearts: part.hearts ?? null,
    supply: part.supply ?? null,
    headline: part.headline ?? null,
    locked: part.locked ?? false,
    broken: part.broken ?? false,
    effect: null,
    tags: part.tags,
    stats: part.stats,
    actions,
  };
}
