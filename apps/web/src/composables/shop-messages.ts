import { getMeta } from '@hexoflat/engine';
import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import { i18n } from '@/i18n';
import type { TradePreview } from '@/services/trade/trade-preview';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import type { ShopDragSource } from './shop-drag-state';
import type { ShopDropLabel } from './shop-drop';
import { showShopToast } from './shop-toast';

const t = (key: string, params?: Record<string, unknown>): string =>
  i18n.global.t(key, params ?? {});

const SYNC_HANDLED: ReadonlySet<string> = new Set(['OFFLINE', 'SESSION_TAKEN_OVER']);

export function shopErrorText(reason: string): string {
  switch (reason) {
    case 'EMPTY_SOURCE':
      return t('shop.error.EMPTY_SOURCE');
    case 'PRICE_CHANGED':
      return t('shop.error.PRICE_CHANGED');
    case 'NOT_ENOUGH_COINS':
      return t('shop.error.NOT_ENOUGH_COINS');
    case 'NOT_TRADEABLE':
      return t('shop.error.NOT_TRADEABLE');
    case 'NOT_AT_TRADER':
      return t('shop.error.NOT_AT_TRADER');
    case 'STACK_FULL':
      return t('shop.error.STACK_FULL');
    case 'SPLIT_TARGET_TAKEN':
      return t('shop.error.SPLIT_TARGET_TAKEN');
    case 'CONTAINER_FULL':
      return t('shop.error.CONTAINER_FULL');
    case 'OVERWEIGHT':
      return t('shop.error.OVERWEIGHT');
    case 'WILL_REJECTED':
      return t('shop.error.WILL_REJECTED');
    case 'BATTLE_OPEN':
      return t('shop.error.BATTLE_OPEN');
    default:
      return t('shop.error.REJECTED');
  }
}

export function warnTrade(reason: string, price: number | null): void {
  if (SYNC_HANDLED.has(reason)) return;
  const tool = useHeroToolStore();
  if (reason === 'NOT_ENOUGH_COINS' && price !== null) {
    tool.setActionMessage(shopErrorText(reason), 'coins', price, 'warn');
    return;
  }
  if (reason === 'WILL_REJECTED' && price !== null) {
    tool.setActionMessage(shopErrorText(reason), 'will', price, 'warn');
    return;
  }
  tool.setActionMessage(shopErrorText(reason), null, null, 'warn');
}

export function shopDropText(label: ShopDropLabel): string {
  switch (label.id) {
    case 'buy':
      return t('shop.drop.buy', { price: label.price });
    case 'buySplit':
      return t('shop.drop.buySplit', { n: label.count, price: label.price });
    case 'sell':
      return t('shop.drop.sell', { price: label.price });
    case 'buyback':
      return t('shop.drop.buyback', { price: label.price });
    case 'cantAfford':
      return t('shop.drop.cantAfford');
    case 'notInterested':
      return t('shop.drop.notInterested');
    case 'cant':
      return t('shop.drop.cant');
  }
}

function itemName(key: THexobjectKey): string {
  const title = getMeta(key).title;
  return i18n.global.te(title) ? i18n.global.t(title) : title;
}

export function announceDeal(
  source: ShopDragSource,
  key: THexobjectKey,
  preview: TradePreview,
  undoSale: (key: THexobjectKey, amount: number) => void,
): void {
  if (!preview.ok) return;
  const name = itemName(key);
  const { amount, price } = preview;
  if (source.kind === 'bag') {
    showShopToast(t('shop.toast.sold', { name, price }), () => undoSale(key, amount));
    return;
  }
  showShopToast(
    source.list === 'buyback'
      ? t('shop.toast.boughtBack', { name, price })
      : t('shop.toast.bought', { name, price }),
  );
}
