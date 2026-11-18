import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import type { ItemToken } from '@hexoflat/engine/tokens/token-schema';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { grantTokenFixture, settleInventorySync } from '@/services/inventory/inventory-sync';
import type { TestTokenSpec } from './test-api.types';

function heldTokens(): ItemToken[] {
  return useHeroInventoryStore().items.flatMap((item) => (item.token ? [item.token] : []));
}

async function grantTokenItem(spec: TestTokenSpec): Promise<ItemToken> {
  if (import.meta.env.VITE_E2E_HOOKS !== 'true') throw new Error('E2E hooks are off');
  await settleInventorySync();
  const before = new Set(heldTokens().map((token) => token.id));
  const answer = await grantTokenFixture(spec);
  if (!answer.ok) throw new Error(`Token grant refused: ${answer.code ?? 'UNKNOWN'}`);
  const granted = heldTokens().find((token) => !before.has(token.id));
  if (!granted) throw new Error(`The granted ${spec.type} token is not in the inventory`);
  return granted;
}

export const inventoryTestApi = {
  grantInventoryItem(key: string, amount: number) {
    if (import.meta.env.VITE_E2E_HOOKS !== 'true') return;
    const result = useHeroInventoryStore().putToInventory(key as THexobjectKey, amount);
    if (!result.ok) throw new Error(`Cannot grant ${amount} x ${key}`);
  },
  grantTokenItem,
};
