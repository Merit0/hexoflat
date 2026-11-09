import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import { grantItemToStores } from '@/services/inventory/inventory-bridge';
import { useHeroStore } from '@/stores/hero-store';
import { useWorldMapStore } from '@/stores/world-map-store';

export const inventoryTestApi = {
  grantInventoryItem(key: string, amount: number) {
    if (import.meta.env.VITE_E2E_HOOKS !== 'true') return;
    const result = grantItemToStores(
      useHeroStore().hero.id,
      useWorldMapStore().buildEngineContext(),
      key as THexobjectKey,
      amount,
      'dev',
    );
    if (!result.ok) throw new Error(`Cannot grant ${amount} x ${key}`);
  },
};
