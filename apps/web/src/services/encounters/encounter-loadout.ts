import type { BattleCreature } from '@hexoflat/engine/battle/battle-state';
import { battleItemOfHexobject } from '@hexoflat/engine/battle/battle-catalogue';
import { heroBattleCreature, type HeroLoadout } from '@hexoflat/engine/encounters/encounter-battle';
import type { Vector } from '@hexoflat/engine/encounters/battlefield-setup';
import { handsProfile, type ThreatProfile } from '@hexoflat/engine/encounters/threat';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';

const BAG_LIMIT = 3;

export interface LoadoutSource {
  heroId: string;
  hearts: number;
  weapon: InventoryItem | null;
  shield: InventoryItem | null;
  items: InventoryItem[];
}

function handKey(item: InventoryItem | null): string | null {
  if (!item || item.key === HEXOBJECT_KEYS.HAND) return null;
  return battleItemOfHexobject(item.key) ? item.key : null;
}

export function heroLoadout(source: LoadoutSource): HeroLoadout {
  const equipped = new Set([source.weapon?.id, source.shield?.id]);
  const bag = source.items
    .filter((item) => !equipped.has(item.id) && battleItemOfHexobject(item.key))
    .flatMap((item) => Array.from({ length: Math.max(1, item.amount) }, () => item.key))
    .slice(0, BAG_LIMIT);
  return {
    id: source.heroId,
    hearts: source.hearts,
    weapon: handKey(source.weapon),
    shield: handKey(source.shield),
    bag,
  };
}

export function heroCreatureFrom(source: LoadoutSource): BattleCreature {
  return heroBattleCreature(heroLoadout(source));
}

export function heroThreatProfile(source: LoadoutSource): ThreatProfile {
  return handsProfile(source.hearts, heroCreatureFrom(source).hands);
}

const COMPASS = ['E', 'SE', 'SW', 'W', 'NW', 'NE'] as const;

export function compassOf(direction: Vector): string {
  const degrees = (Math.atan2(direction.y, direction.x) * 180) / Math.PI;
  const sector = Math.round((((degrees % 360) + 360) % 360) / 60) % 6;
  return COMPASS[sector];
}
