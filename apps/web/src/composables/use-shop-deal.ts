import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import { i18n } from '@/i18n';
import { dealWithTrader } from '@/services/trade/trade-commands';
import { useTraderStore } from '@/stores/trader-store';
import { clearShopSelection } from './shop-selection';
import { itemName, warnTrade } from './shop-messages';
import { showShopToast } from './shop-toast';

let pending = false;

export function parseGuess(raw: string): number | null {
  if (!/^\d{1,3}$/.test(raw)) return null;
  const guess = Number(raw);
  return guess >= 1 ? guess : null;
}

export async function submitDeal(index: number, key: THexobjectKey, guess: number): Promise<void> {
  const trader = useTraderStore().traderKey;
  if (!trader || pending) return;
  pending = true;
  try {
    const outcome = await dealWithTrader(trader, index, guess);
    const name = itemName(key);
    if (outcome.kind === 'bought') {
      showShopToast(
        i18n.global.t('shop.toast.dealExact', {
          name,
          price: outcome.price,
          saved: outcome.saved,
        }),
      );
      return;
    }
    if (outcome.kind === 'wasted') {
      clearShopSelection();
      showShopToast(i18n.global.t('shop.toast.dealWasted', { name }));
      return;
    }
    if (outcome.reason === 'NOT_ENOUGH_COINS') {
      showShopToast(i18n.global.t('shop.toast.dealShort'));
      return;
    }
    warnTrade(outcome.reason, outcome.price);
  } finally {
    pending = false;
  }
}
