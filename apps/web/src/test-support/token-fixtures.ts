import { ETokenType } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';
import { getPrototype } from '@hexoflat/engine';
import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import { gameTokenFactory } from '@hexoflat/engine/tokens/game-tokens';
import type { TMapTier } from '@hexoflat/engine/tokens/token-keys';
import type { ItemToken } from '@hexoflat/engine/tokens/token-schema';

export function baseTestToken(
  type = 'sword',
  tokenType: ETokenType = ETokenType.IDOL,
  mapTier: TMapTier = 1,
): ItemToken {
  const result = gameTokenFactory().createBase({
    seed: 'web-test',
    sourceId: 'test:web.base',
    n: 0,
    tokenType,
    mapTier,
    type,
  });
  if (!result.ok) throw new Error(result.refusal.code);
  return result.value;
}

export function uniqueTestToken(uniqueKey = 'lantern-eater'): ItemToken {
  const result = gameTokenFactory().createUnique(uniqueKey, {
    seed: 'web-test',
    sourceId: 'test:web.unique',
    n: 0,
    mapTier: 3,
    ownedUniques: [],
  });
  if (!result.ok) throw new Error(result.refusal.code);
  return result.value;
}

export function tokenItem(
  token: ItemToken,
  slotKey: string,
  id = `item-${token.id}`,
): InventoryItem {
  const key = token.type as THexobjectKey;
  return {
    id,
    key,
    type: getPrototype(key).groupType,
    amount: 1,
    token,
    slotKey,
    isNew: false,
  };
}
