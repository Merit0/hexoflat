import type { BattleCreature } from '@hexoflat/engine/battle/battle-state';
import { heroBattleCreature, type HeroLoadout } from '@hexoflat/engine/squads/squad-battle';
import type { Vector } from '@hexoflat/engine/battle/battlefield-setup';
import { loadoutFromInventory } from '@hexoflat/engine/squads/inventory-loadout';
import { inventoryStateFromStores } from '@/services/inventory/inventory-bridge';

export interface LoadoutSource {
  heroId: string;
  hearts: number;
  maxHearts: number;
}

/** The hero's hands and bag are read by the engine from his inventory; the web only adds his health. */
export function heroLoadout(source: LoadoutSource): HeroLoadout {
  const inventory = inventoryStateFromStores(source.heroId);
  return {
    ...loadoutFromInventory(inventory, source.hearts, source.maxHearts),
    id: source.heroId,
  };
}

export function heroCreatureFrom(source: LoadoutSource): BattleCreature {
  return heroBattleCreature(heroLoadout(source));
}

const COMPASS = ['E', 'SE', 'SW', 'W', 'NW', 'NE'] as const;

export function compassOf(direction: Vector): string {
  const degrees = (Math.atan2(direction.y, direction.x) * 180) / Math.PI;
  const sector = Math.round((((degrees % 360) + 360) % 360) / 60) % 6;
  return COMPASS[sector];
}
