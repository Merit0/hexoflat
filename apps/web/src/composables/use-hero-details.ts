import { computed } from 'vue';
import { getScoutProgress, toRoman } from '@hexoflat/engine/hero-movement/scout-progression';
import { BATTLE_ITEMS, battleItemOfHexobject } from '@hexoflat/engine/battle/battle-catalogue';
import { THREAT_RULES } from '@hexoflat/engine/battle/threat';
import { sumShieldPoints } from '@hexoflat/engine/combat/shield-points';
import type { SkillProgress } from '@hexoflat/engine/skills/sacrifice-rules';
import type { SkillRanks } from '@hexoflat/engine/skills/skill-rules';
import { MapRegistry } from '@hexoflat/engine/registry/world-map-registry';
import { getPrototype } from '@hexoflat/engine';
import type { TRarityTone } from '@hexoflat/engine/content/rarity-rules';
import { HEXOBJECT_KEYS, type THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import { resolveItemTooltip } from '@hexoflat/engine/utils/inventory/item-tooltip';
import { resolveInventoryView } from '@hexoflat/engine/utils/inventory/traits-resolver';
import { useHeroStore } from '@/stores/hero-store';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useBattleStore } from '@/stores/battle-store';
import { getObjectRarityTone } from '@/render/rarity';
import { SHIELD_SLOTS } from '@/constants/shield-slots';
import { buildSkillTreeView, type SkillTreeView } from './skill-tree-view';

export const HERO_PORTRAIT_URL = '/hero-asssets/human-hex.png';
export const WILL_ICON_URL = '/board-assets/will-icon-image.png';
export { SHIELD_SLOTS };

export type HeroDetailsTab = 'state' | 'skills';
export type HeroStatId = 'attack' | 'defense' | 'load' | 'victories';

export interface HandItem {
  titleKey: string;
  rarity: TRarityTone | null;
  willCost: number | null;
}

export interface HeroDetailsInput {
  name: string;
  locationTitle: string;
  steps: number;
  currentHealth: number;
  maxHealth: number;
  coins: number;
  kills: number;
  carriedKg: number;
  capacityKg: number;
  shieldPoints: number;
  extraShields: number;
  skills: SkillRanks;
  skillProgress: SkillProgress;
  skillsLocked: boolean;
  will: { current: number; capacity: number } | null;
  weapon: { item: HandItem; power: number } | null;
  shield: { item: HandItem; sides: number } | null;
  defense: number;
}

export interface HeroDetailsView {
  name: string;
  locationTitle: string;
  steps: number;
  rank: { roman: string; title: string };
  hearts: { current: number; max: number; count: number };
  shields: { filled: number; total: number };
  will: { current: number; capacity: number } | null;
  tiles: Array<{ id: HeroStatId; value: string }>;
  hands: { right: HandItem | null; left: HandItem | null };
  skillTree: SkillTreeView;
  scout: { roman: string; title: string; steps: number; nextAt: number | null; percent: number };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function shieldsFilled(input: HeroDetailsInput): number {
  if (input.shieldPoints <= 0) return 0;
  return Math.min(SHIELD_SLOTS, input.shieldPoints + Math.max(0, input.extraShields));
}

function fixed2(value: number): string {
  return value.toFixed(2);
}

function scoutView(steps: number): HeroDetailsView['scout'] {
  const progress = getScoutProgress(steps);
  const span = progress.next ? progress.next.minSteps - progress.current.minSteps : 0;
  const percent = progress.next
    ? Math.round(((progress.steps - progress.current.minSteps) / span) * 100)
    : 100;

  return {
    roman: toRoman(progress.current.rank),
    title: progress.current.title,
    steps: progress.steps,
    nextAt: progress.nextRankAt,
    percent: Math.max(0, Math.min(100, percent)),
  };
}

export function buildHeroDetails(input: HeroDetailsInput): HeroDetailsView {
  const scout = scoutView(input.steps);
  const max = Math.max(1, input.maxHealth);
  const current = Math.max(0, Math.min(max, input.currentHealth));
  const attack = input.weapon?.power ?? THREAT_RULES.unarmedPower;
  const defense = round2(input.defense);

  return {
    name: input.name,
    locationTitle: input.locationTitle,
    steps: scout.steps,
    rank: { roman: scout.roman, title: scout.title },
    hearts: { current: round1(current), max: round1(max), count: Math.ceil(max) },
    shields: { filled: shieldsFilled(input), total: SHIELD_SLOTS },
    will: input.will,
    tiles: [
      { id: 'attack', value: String(attack) },
      { id: 'defense', value: String(defense) },
      { id: 'load', value: `${fixed2(input.carriedKg)} / ${fixed2(input.capacityKg)}` },
      { id: 'victories', value: String(input.kills) },
    ],
    hands: { right: input.weapon?.item ?? null, left: input.shield?.item ?? null },
    skillTree: buildSkillTreeView({
      ranks: input.skills,
      progress: input.skillProgress,
      will: input.will ?? { current: 0, capacity: 0 },
      locked: input.skillsLocked,
    }),
    scout,
  };
}

function battleStat(key: THexobjectKey, stat: 'power' | 'shieldCapacity'): number {
  const item = battleItemOfHexobject(key);
  return item ? (BATTLE_ITEMS[item]?.[stat] ?? 0) : 0;
}

function toHandItem(key: THexobjectKey, skills: SkillRanks): HandItem {
  const view = resolveInventoryView(key);
  return {
    titleKey: view.title,
    rarity: getObjectRarityTone(getPrototype(key)),
    willCost: resolveItemTooltip(key, { skills }).use?.will ?? null,
  };
}

export function useHeroDetails() {
  const heroStore = useHeroStore();
  const inventory = useHeroInventoryStore();
  const battle = useBattleStore();

  return computed<HeroDetailsView>(() => {
    const hero = heroStore.hero;
    const key = heroStore.nav.locationKey;
    const knowledge = heroStore.knowledge;
    const skills = knowledge?.skills ?? {};
    const equipped = inventory.equippedItems;
    const weaponItem = equipped.weapon;
    const shieldItem = equipped.shield;
    const weapon =
      weaponItem && weaponItem.key !== HEXOBJECT_KEYS.HAND
        ? {
            item: toHandItem(weaponItem.key, skills),
            power: battleStat(weaponItem.key, 'power') || THREAT_RULES.unarmedPower,
          }
        : null;
    const shield =
      shieldItem && shieldItem.key !== HEXOBJECT_KEYS.HAND
        ? {
            item: toHandItem(shieldItem.key, skills),
            sides: battleStat(shieldItem.key, 'shieldCapacity'),
          }
        : null;
    const defense = [weaponItem, shieldItem].reduce(
      (sum, item) => sum + (item ? battleStat(item.key, 'shieldCapacity') : 0),
      0,
    );

    return buildHeroDetails({
      name: hero.name || 'Hero',
      locationTitle: key ? (MapRegistry.get(key)?.title ?? key) : 'Nowhere',
      steps: hero.heroSteps,
      currentHealth: hero.currentHealth,
      maxHealth: hero.getEffectiveMaxHealth(),
      coins: hero.coins,
      kills: hero.kills,
      carriedKg: inventory.carriedWeightKg,
      capacityKg: inventory.carryCapacityKg,
      shieldPoints: sumShieldPoints(Object.values(equipped).map((item) => item?.key)),
      extraShields: heroStore.extraShields,
      skills: knowledge?.skills ?? {},
      skillProgress: knowledge?.skillProgress ?? {},
      skillsLocked: heroStore.isHeroMoving || battle.inBattle,
      will: knowledge ? { current: knowledge.current, capacity: knowledge.capacity } : null,
      weapon,
      shield,
      defense,
    });
  });
}
