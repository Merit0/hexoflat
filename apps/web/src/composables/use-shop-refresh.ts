import { ref } from 'vue';
import { refreshTrader } from '@/services/trade/trade-commands';
import type { RefreshPreview } from '@/services/trade/trade-preview';
import { useTraderStore } from '@/stores/trader-store';
import { clearShopSelection } from './shop-selection';
import { warnTrade } from './shop-messages';

export const refreshSending = ref(false);

export async function refreshShop(refresh: RefreshPreview | null): Promise<void> {
  const key = useTraderStore().traderKey;
  if (!key || !refresh || refreshSending.value) return;
  if (!refresh.affordable) {
    warnTrade('WILL_REJECTED', refresh.price);
    return;
  }
  refreshSending.value = true;
  try {
    const outcome = await refreshTrader(key);
    if (outcome.ok) clearShopSelection();
    else warnTrade(outcome.reason, outcome.price);
  } finally {
    refreshSending.value = false;
  }
}
