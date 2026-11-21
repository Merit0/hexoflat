import type { InventoryState } from '../inventory/inventory-state';
import { resolveHeroStats } from '../tokens/equipment/hero-stats';
import { BASE_FOG_RADIUS } from './fog-service';

export function heroFogRadius(inventory?: Pick<InventoryState, 'equip'>): number {
  const stats = resolveHeroStats(Object.values(inventory?.equip ?? {}));
  return BASE_FOG_RADIUS + stats.fogRadius;
}
