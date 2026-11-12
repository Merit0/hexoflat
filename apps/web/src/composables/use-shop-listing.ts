import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import { i18n } from '@/i18n';
import { listOwnItem, repriceOwnItem, unlistOwnItem } from '@/services/trade/trade-commands';
import { useTraderStore } from '@/stores/trader-store';
import { itemName, warnTrade } from './shop-messages';
import { clearShopSelection } from './shop-selection';
import { showShopToast } from './shop-toast';

let pending = false;

async function run(job: (trader: NonNullable<ReturnType<typeof traderKeyOf>>) => Promise<void>) {
  const trader = traderKeyOf();
  if (!trader || pending) return;
  pending = true;
  try {
    await job(trader);
  } finally {
    pending = false;
  }
}

function traderKeyOf() {
  return useTraderStore().traderKey;
}

const t = (key: string, params: Record<string, unknown>): string => i18n.global.t(key, params);

export function submitList(
  bagIndex: number,
  key: THexobjectKey,
  amount: number,
  unitPrice: number,
): Promise<void> {
  return run(async (trader) => {
    const outcome = await listOwnItem(trader, bagIndex, unitPrice, amount);
    if (!outcome.ok) {
      warnTrade(outcome.reason, outcome.price);
      return;
    }
    clearShopSelection();
    const name = itemName(key);
    showShopToast(
      amount > 1
        ? t('shop.toast.listedMany', { name, n: amount, price: unitPrice })
        : t('shop.toast.listed', { name, price: unitPrice }),
    );
  });
}

export function submitUnlist(slot: number, key: THexobjectKey): Promise<void> {
  return run(async (trader) => {
    const outcome = await unlistOwnItem(trader, slot);
    if (!outcome.ok) {
      warnTrade(outcome.reason, outcome.price);
      return;
    }
    clearShopSelection();
    showShopToast(t('shop.toast.tookBack', { name: itemName(key) }));
  });
}

export function submitReprice(slot: number, key: THexobjectKey, unitPrice: number): Promise<void> {
  return run(async (trader) => {
    const outcome = await repriceOwnItem(trader, slot, unitPrice);
    if (!outcome.ok) {
      warnTrade(outcome.reason, outcome.price);
      return;
    }
    showShopToast(t('shop.toast.repriced', { name: itemName(key), price: unitPrice }));
  });
}
