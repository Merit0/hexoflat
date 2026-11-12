import { TRADER_KEYS, type TTraderKey } from '@hexoflat/engine/content/traders.content';
import { walletCoins } from '@hexoflat/engine/trade/trader-view';
import type { TraderState } from '@hexoflat/engine/trade/trade-state';
import { apiClient } from '@/api/client';
import { inventorySession } from '@/services/inventory/inventory-session';
import { applyProgress, settleInventorySync } from '@/services/inventory/inventory-sync';
import type { ProjectedAggregate } from '@/services/player/player-socket';
import { currentInventory } from '@/services/trade/trade-commands';
import { previewRefresh } from '@/services/trade/trade-preview';
import { traderProjection } from '@/services/trade/trader-projection';
import { useTraderStore } from '@/stores/trader-store';
import type { TestTrader, TestTraderFixture } from './test-api.types';

function traderKeyOf(key: string | undefined): TTraderKey {
  const found = TRADER_KEYS.find((candidate) => candidate === (key ?? TRADER_KEYS[0]));
  if (!found) throw new Error(`Unknown trader ${String(key)}`);
  return found;
}

function testTrader(key: TTraderKey, state: TraderState): TestTrader {
  const { trips } = traderProjection.value;
  const will = inventorySession.knowledge?.current ?? 0;
  return {
    key,
    serial: state.serial,
    trips,
    goods: state.goods.map((cell) => (cell ? { ...cell } : null)),
    buyback: state.buyback.map((cell) => (cell ? { ...cell } : null)),
    refreshPrice: previewRefresh(key, state, trips, will).price,
  };
}

async function setTraderOnServer(fixture: TestTraderFixture): Promise<void> {
  if (import.meta.env.VITE_E2E_HOOKS !== 'true') return;
  await settleInventorySync();
  let answer: { aggregates: { progress?: ProjectedAggregate } };
  try {
    answer = await apiClient.post<typeof answer>(
      '/player/dev/trader-fixture',
      { ...fixture, trader: traderKeyOf(fixture.trader) },
      { headers: { 'X-Player-Session': inventorySession.sessionToken ?? '' } },
    );
  } catch (error) {
    throw new Error(
      `Trader fixture refused (start the API with HEXOFLAT_E2E_FIXTURES=1): ${String(error)}`,
    );
  }
  applyProgress(answer.aggregates.progress);
}

export const shopTestApi = {
  getTrader(key?: string): TestTrader | null {
    const traderKey = traderKeyOf(key);
    const state = traderProjection.value.traders[traderKey];
    return state ? testTrader(traderKey, state) : null;
  },
  getListings() {
    return traderProjection.value.listings.map((cell) => (cell ? { ...cell } : null));
  },
  getOpenTrader(): string | null {
    return useTraderStore().traderKey;
  },
  getWalletCoins(): number {
    return walletCoins(currentInventory());
  },
  setTrader: setTraderOnServer,
};
