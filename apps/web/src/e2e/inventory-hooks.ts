import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';

export const inventoryTestApi = {
  grantInventoryItem(key: string, amount: number) {
    if (import.meta.env.VITE_E2E_HOOKS !== 'true') return;
    const result = useHeroInventoryStore().putToInventory(key as THexobjectKey, amount);
    if (!result.ok) throw new Error(`Cannot grant ${amount} x ${key}`);
  },
};
