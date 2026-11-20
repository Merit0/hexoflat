import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import type { ItemToken } from '@hexoflat/engine/tokens/token-schema';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import {
  grantTokenFixture,
  pushInventoryFixture,
  settleInventorySync,
} from '@/services/inventory/inventory-sync';
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

async function grantLegacyAttribute(
  key: 'fog' | 'will' | 'deft-hands' | 'smart-step',
  bonus: number,
): Promise<ItemToken> {
  const token = await grantTokenItem({
    type: 'shield',
    realm: 'idol',
    mapTier: 1,
    attributes: [],
  });
  const item = useHeroInventoryStore().items.find((entry) => entry.token?.id === token.id);
  if (!item?.token) throw new Error('No granted token');
  // Owned tokens retain attributes their type can no longer roll. Planned jewelry/clothing generation stays disabled.
  item.token = { ...item.token, attributes: [{ key, value: bonus }] };
  const owned = item.token;
  pushInventoryFixture();
  await settleInventorySync();
  return owned;
}

export const inventoryTestApi = {
  grantInventoryItem(key: string, amount: number) {
    if (import.meta.env.VITE_E2E_HOOKS !== 'true') return;
    const result = useHeroInventoryStore().putToInventory(key as THexobjectKey, amount);
    if (!result.ok) throw new Error(`Cannot grant ${amount} x ${key}`);
  },
  grantTokenItem,
  async grantWillToken(bonus: number, mapTier: TestTokenSpec['mapTier'] = 1): Promise<ItemToken> {
    if (import.meta.env.VITE_E2E_HOOKS !== 'true') throw new Error('E2E hooks are off');
    if (!Number.isInteger(bonus) || bonus < 1 || bonus > mapTier * 10)
      throw new Error('Invalid Will bonus');
    return grantTokenItem({
      type: 'shield',
      realm: 'idol',
      mapTier,
      attributes: [{ key: 'will', value: bonus }],
    });
  },
  async grantLegacyDeftHandsToken(bonus: number): Promise<ItemToken> {
    if (import.meta.env.VITE_E2E_HOOKS !== 'true') throw new Error('E2E hooks are off');
    if (bonus !== 1 && bonus !== 2) throw new Error('Invalid Deft Hands bonus');
    return grantLegacyAttribute('deft-hands', bonus);
  },
  async grantLegacySightToken(bonus: number): Promise<ItemToken> {
    if (import.meta.env.VITE_E2E_HOOKS !== 'true') throw new Error('E2E hooks are off');
    if (bonus !== 1 && bonus !== 2) throw new Error('Invalid sight bonus');
    return grantLegacyAttribute('fog', bonus);
  },
  async grantLegacySmartStepToken(every: number): Promise<ItemToken> {
    if (import.meta.env.VITE_E2E_HOOKS !== 'true') throw new Error('E2E hooks are off');
    if (!Number.isInteger(every) || every < 1 || every > 5)
      throw new Error('Invalid Smart Step interval');
    return grantLegacyAttribute('smart-step', every);
  },
};
