import { computed } from 'vue';
import { getScoutProgress, toRoman } from '@hexoflat/engine/hero-movement/scout-progression';
import { getAttackMultiplier, getMarkerDefense } from '@hexoflat/engine/combat/damage-calculator';
import { MapRegistry } from '@hexoflat/engine/registry/world-map-registry';
import { getPrototype } from '@hexoflat/engine';
import type { EEquipmentRarity } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { HEXOBJECT_KEYS, type THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import { resolveInventoryView } from '@hexoflat/engine/utils/inventory/traits-resolver';
import { useHeroStore } from '@/stores/hero-store';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { getObjectRarity } from '@/render/rarity';

export const HERO_PORTRAIT_URL = '/hero-asssets/human-hex.png';
export const WILL_ICON_URL = '/board-assets/will-icon-image.png';
export const SHIELD_SLOTS = 6;

export type HeroDetailsTab = 'state' | 'path';
export type HeroStatId = 'attack' | 'defense' | 'load' | 'victories';

export interface HandItem {
  titleKey: string;
  rarity: EEquipmentRarity | null;
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
  will: { current: number; capacity: number } | null;
  weapon: { item: HandItem; multiplier: number } | null;
  shield: { item: HandItem; defense: number } | null;
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
  scout: { roman: string; title: string; steps: number; nextAt: number | null; percent: number };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
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
  const multiplier = input.weapon?.multiplier ?? 1;
  const defense = round1(input.defense);

  return {
    name: input.name,
    locationTitle: input.locationTitle,
    steps: scout.steps,
    rank: { roman: scout.roman, title: scout.title },
    hearts: { current: round1(current), max: round1(max), count: Math.ceil(max) },
    shields: { filled: Math.min(SHIELD_SLOTS, Math.floor(defense)), total: SHIELD_SLOTS },
    will: input.will,
    tiles: [
      { id: 'attack', value: `×${multiplier}` },
      { id: 'defense', value: String(defense) },
      { id: 'load', value: `${fixed2(input.carriedKg)} / ${fixed2(input.capacityKg)}` },
      { id: 'victories', value: String(input.kills) },
    ],
    hands: { right: input.weapon?.item ?? null, left: input.shield?.item ?? null },
    scout,
  };
}

function toHandItem(key: THexobjectKey): HandItem {
  const view = resolveInventoryView(key);
  return {
    titleKey: view.title,
    rarity: getObjectRarity(getPrototype(key)),
  };
}

export function useHeroDetails() {
  const heroStore = useHeroStore();
  const inventory = useHeroInventoryStore();

  return computed<HeroDetailsView>(() => {
    const hero = heroStore.hero;
    const key = heroStore.nav.locationKey;
    const knowledge = heroStore.knowledge;
    const equipped = inventory.equippedItems;
    const weaponItem = equipped.weapon;
    const shieldItem = equipped.shield;
    const weapon =
      weaponItem && weaponItem.key !== HEXOBJECT_KEYS.HAND
        ? { item: toHandItem(weaponItem.key), multiplier: getAttackMultiplier(weaponItem.key) }
        : null;
    const shield =
      shieldItem && shieldItem.key !== HEXOBJECT_KEYS.HAND
        ? { item: toHandItem(shieldItem.key), defense: getMarkerDefense(shieldItem.key) }
        : null;
    const defense = Object.values(equipped).reduce(
      (sum, item) => sum + (item ? getMarkerDefense(item.key) : 0),
      0,
    );

    return buildHeroDetails({
      name: hero.name || 'Hero',
      locationTitle: key ? (MapRegistry.get(key)?.title ?? key) : 'Nowhere',
      steps: hero.heroSteps,
      currentHealth: hero.currentHealth,
      maxHealth: hero.maxHealth,
      coins: hero.coins,
      kills: hero.kills,
      carriedKg: inventory.carriedWeightKg,
      capacityKg: inventory.carryCapacityKg,
      will: knowledge ? { current: knowledge.current, capacity: knowledge.capacity } : null,
      weapon,
      shield,
      defense,
    });
  });
}
