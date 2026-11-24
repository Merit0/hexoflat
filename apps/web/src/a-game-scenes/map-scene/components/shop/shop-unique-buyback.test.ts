import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { settleShopDeal } from '@/composables/use-shop-drag';
import { shopToast } from '@/composables/shop-toast';
import { pushInventoryFixture, settleInventorySync } from '@/services/inventory/inventory-sync';
import { currentInventory, heldUniques } from '@/services/trade/trade-commands';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { sentCommands } from '@/test-support/fake-player-server';
import { uniqueTestToken } from '@/test-support/token-fixtures';
import {
  bagCellWith,
  byId,
  coins,
  ilva,
  message,
  mountShop,
  openBuybackTab,
  pointer,
  registerShopCleanup,
  shopCommands,
} from './shop-board-trade-kit';

vi.mock('@/services/player/player-socket', async () =>
  (await import('@/test-support/fake-player-server')).fakePlayerSocketModule(),
);

registerShopCleanup();

const token = uniqueTestToken();
const bagTokens = () => currentInventory().bag.flatMap((item) => item?.token ?? []);

async function sellTheUnique() {
  bagCellWith(K.SWORD).dispatchEvent(pointer('contextmenu', {}));
  await settleShopDeal();
  await openBuybackTab();
}

describe('unique buy-back section (DA5c)', () => {
  beforeEach(async () => {
    await mountShop({ coins: 10 });
    const inventory = useHeroInventoryStore();
    inventory.putToInventory(K.SWORD, 1);
    await settleInventorySync();
    inventory.items.find((item) => item.key === K.SWORD)!.token = token;
    pushInventoryFixture();
    await settleInventorySync();
    await nextTick();
    sentCommands.length = 0;
  });

  it('is hidden while the trader holds no unique', async () => {
    await openBuybackTab();
    expect(byId('shop-unique-buyback')).toBeNull();
    expect(byId('shop-buyback-empty')).not.toBeNull();
  });

  it('shows the sold instance at its sale price and gives the same instance back', async () => {
    await sellTheUnique();
    const [{ price }] = heldUniques('ilva');
    expect(byId('shop-unique-buyback-0').dataset.instanceId).toBe(token.instanceId);
    expect(byId('shop-unique-buyback-price-0').dataset.price).toBe(String(price));
    expect(byId('shop-tab-buyback').dataset.count).toBe('1');
    expect(byId('shop-buyback-empty')).toBeNull();
    expect(ilva().buyback.every((entry) => entry === null)).toBe(true);

    byId('shop-unique-buyback-action-0').click();
    await settleShopDeal();
    await nextTick();
    expect(shopCommands()).toEqual(['SHOP_SELL', 'SHOP_BUY_BACK_UNIQUE']);
    expect(bagTokens()).toEqual([token]);
    expect(coins()).toBe(10);
    expect(byId('shop-unique-buyback')).toBeNull();
  });

  it('undoes the sale from the toast', async () => {
    await sellTheUnique();
    shopToast.current!.undo!();
    await settleShopDeal();
    expect(shopCommands()).toEqual(['SHOP_SELL', 'SHOP_BUY_BACK_UNIQUE']);
    expect(bagTokens()).toEqual([token]);
  });

  it('warns and keeps the entry when the coins are spent', async () => {
    await sellTheUnique();
    const inventory = useHeroInventoryStore();
    inventory.items = inventory.items.filter((item) => item.key !== K.COINS);
    pushInventoryFixture();
    await settleInventorySync();
    await nextTick();
    expect(byId('shop-unique-buyback-price-0').dataset.affordable).toBe('false');
    byId('shop-unique-buyback-action-0').click();
    await settleShopDeal();
    expect(message()).toBeTruthy();
    expect(heldUniques('ilva')).toHaveLength(1);
    expect(bagTokens()).toEqual([]);
  });
});
