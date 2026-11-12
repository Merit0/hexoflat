import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import { apiClient } from '@/api/client';
import { inventorySession } from '@/services/inventory/inventory-session';
import { settleInventorySync } from '@/services/inventory/inventory-sync';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useTraderStore } from '@/stores/trader-store';
import { seedFakeSession } from '@/test-support/fake-session';
import { shopTestApi } from './shop-hooks';

vi.mock('@/services/player/player-socket', async () =>
  (await import('@/test-support/fake-player-server')).fakePlayerSocketModule(),
);

describe('shop test hooks', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_E2E_HOOKS', 'true');
    setActivePinia(createPinia());
    seedFakeSession('hero-1');
    inventorySession.sessionToken = 'session-1';
  });
  afterEach(() => vi.unstubAllEnvs());

  it('reads the served trader with its refresh price', () => {
    const trader = shopTestApi.getTrader();

    expect(trader).toMatchObject({ key: 'ilva', serial: 0, trips: 0, refreshPrice: 20 });
    expect(trader!.goods).toHaveLength(8);
  });

  it('sets the trader through the server fixture and shows the answer', async () => {
    const post = vi.mocked(apiClient.post);

    await shopTestApi.setTrader({
      goods: [{ key: K.SWORD, amount: 1 }],
      buyback: [{ key: K.AXE, amount: 1, unitPrice: 19 }],
      trips: 2,
    });

    expect(post).toHaveBeenCalledWith(
      '/player/dev/trader-fixture',
      expect.objectContaining({ trader: 'ilva', trips: 2 }),
      { headers: { 'X-Player-Session': 'session-1' } },
    );
    const trader = shopTestApi.getTrader()!;
    expect(trader.trips).toBe(2);
    expect(trader.goods[0]).toEqual({ key: K.SWORD, amount: 1 });
    expect(trader.goods.slice(1).every((cell) => cell === null)).toBe(true);
    expect(trader.buyback[0]).toEqual({ key: K.AXE, amount: 1, unitPrice: 19 });
  });

  it('counts the coins in the bag and the hands', async () => {
    useHeroInventoryStore().putToInventory(K.COINS, 120);
    await settleInventorySync();

    expect(shopTestApi.getWalletCoins()).toBe(120);
  });

  it('tells which trader board is open', () => {
    expect(shopTestApi.getOpenTrader()).toBeNull();
    useTraderStore().open('ilva');
    expect(shopTestApi.getOpenTrader()).toBe('ilva');
  });
});
