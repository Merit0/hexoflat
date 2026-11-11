import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import { shopDrag } from '@/composables/shop-drag-state';
import { shopSelection } from '@/composables/shop-selection';
import { closeShopBoard } from '@/composables/use-shop-board';
import { settleShopDeal } from '@/composables/use-shop-drag';
import { settleInventorySync } from '@/services/inventory/inventory-sync';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { sentCommands } from '@/test-support/fake-player-server';
import {
  view,
  byId,
  coins,
  ilva,
  bagKeys,
  shopCommands,
  pointer,
  bagCell,
  bagCellWith,
  openBuybackTab,
  mountShop,
  drag,
  drop,
  registerShopCleanup,
  POTION_PRICE,
} from './shop-board-trade-kit';

vi.mock('@/services/player/player-socket', async () =>
  (await import('@/test-support/fake-player-server')).fakePlayerSocketModule(),
);

registerShopCleanup();

describe('selecting a good and pressing Buy', () => {
  const select = async (id: string) => {
    byId(id).dispatchEvent(pointer('click', {}));
    await nextTick();
  };

  it('shows the empty card until something is clicked, then names the item and one unit to buy', async () => {
    await mountShop({ coins: 1000 });
    expect(byId('shop-card').dataset.itemKey).toBeUndefined();

    await select('shop-goods-cell-0');

    expect(byId('shop-card').dataset.itemKey).toBe(K.HEALTH_BOTTLE);
    expect(byId('shop-card').dataset.mode).toBe('buying');
    expect(byId('shop-card-name').textContent).toBeTruthy();
    expect(byId('shop-qty-value').dataset.qty).toBe('1');
    expect(byId('shop-goods-cell-0').dataset.selected).toBe('true');
    expect(byId('shop-card-action').textContent?.trim()).toBe('Buy');
    expect(shopCommands()).toEqual([]);
  });

  it('Buy purchases one unit by default and the toast reports it', async () => {
    await mountShop({ coins: 1000 });
    await select('shop-goods-cell-0');

    byId('shop-card-action').click();
    await settleShopDeal();
    await nextTick();

    expect(shopCommands()).toEqual(['SHOP_BUY']);
    expect(coins()).toBe(1000 - POTION_PRICE);
    expect(bagKeys()).toContain(`${K.HEALTH_BOTTLE}x1`);
    expect(ilva().goods[0]).toEqual({ key: K.HEALTH_BOTTLE, amount: 3 });
    expect(byId('shop-toast-text').textContent).toContain('Bought');
  });

  it('Max then Buy takes the whole stack and leaves it Sold out', async () => {
    await mountShop({ coins: 1000 });
    await select('shop-goods-cell-0');

    byId('shop-qty-max').click();
    await nextTick();
    expect(byId('shop-qty-value').dataset.qty).toBe('4');
    byId('shop-card-action').click();
    await settleShopDeal();
    await nextTick();

    expect(coins()).toBe(1000 - POTION_PRICE * 4);
    expect(ilva().goods[0]).toEqual({ key: K.HEALTH_BOTTLE, amount: 4, sold: true });
    expect(byId('shop-card').dataset.itemKey).toBeUndefined();
  });

  it('the counter never goes below one or above the stock', async () => {
    await mountShop({ coins: 1000 });
    await select('shop-goods-cell-0');

    byId('shop-qty-dec').click();
    await nextTick();
    expect(byId('shop-qty-value').dataset.qty).toBe('1');
    for (let at = 0; at < 6; at += 1) byId('shop-qty-inc').click();
    await nextTick();
    expect(byId('shop-qty-value').dataset.qty).toBe('4');
  });

  it('selecting another good moves the card, resets the counter and moves the highlight', async () => {
    await mountShop({ coins: 1000 });
    await select('shop-goods-cell-0');
    byId('shop-qty-inc').click();
    await nextTick();

    await select('shop-goods-cell-1');

    expect(byId('shop-card').dataset.itemKey).toBe(K.SWORD);
    expect(byId('shop-goods-cell-0').dataset.selected).toBe('false');
    expect(byId('shop-goods-cell-1').dataset.selected).toBe('true');
  });

  it('too few coins: Buy is disabled, no red text, no command', async () => {
    await mountShop({ coins: 100 });
    await select('shop-goods-cell-1');

    expect((byId('shop-card-action') as HTMLButtonElement).disabled).toBe(true);
    expect(view.host!.querySelector('[data-testid="shop-card-reason"]')).toBeNull();
    byId('shop-card-action').click();
    await settleShopDeal();

    expect(shopCommands()).toEqual([]);
    expect(coins()).toBe(100);
    expect(byId('shop-card').dataset.itemKey).toBe(K.SWORD);
  });

  it('too heavy: Buy is disabled and the card says why', async () => {
    await mountShop({ coins: 1000 });
    useHeroInventoryStore().carryCapacityKg = 0.5;
    await nextTick();
    await select('shop-goods-cell-1');

    expect((byId('shop-card-action') as HTMLButtonElement).disabled).toBe(true);
    expect(byId('shop-card-reason').dataset.reason).toBe('OVERWEIGHT');
  });

  it('a BUYBACK item is selected on its tab and its button buys it back at the sale price', async () => {
    await mountShop({ coins: 300, buyback: [{ key: K.SWORD, amount: 1, unitPrice: 200 }] });
    await openBuybackTab();
    await select('shop-buyback-cell-0');

    expect(byId('shop-card').dataset.mode).toBe('buyback');
    expect(byId('shop-card-action').textContent?.trim()).toBe('Buy back · 200');
    byId('shop-card-action').click();
    await settleShopDeal();
    await nextTick();
    expect(coins()).toBe(100);
  });

  it('tapping a bag item opens Trading with the price, and Trade sells it with an Undo toast', async () => {
    await mountShop({ coins: 10 });
    useHeroInventoryStore().putToInventory(K.SWORD, 1);
    await settleInventorySync();
    await nextTick();

    bagCellWith(K.SWORD).dispatchEvent(pointer('click', {}));
    await nextTick();
    expect(byId('shop-card').dataset.mode).toBe('trading');
    expect(byId('shop-card-trade-price').textContent).toContain('Price');
    expect(byId('shop-card-action').textContent?.trim()).toBe('Trade');
    expect(bagCellWith(K.SWORD).querySelector('[data-testid="shop-bag-sum"]')).not.toBeNull();

    byId('shop-card-action').click();
    await settleShopDeal();
    await nextTick();
    expect(shopCommands()).toEqual(['SHOP_SELL']);
    expect(ilva().buyback[0]?.key).toBe(K.SWORD);
    expect(byId('shop-toast-undo')).not.toBeNull();

    byId('shop-toast-undo').click();
    await settleShopDeal();
    await nextTick();
    expect(shopCommands()).toEqual(['SHOP_SELL', 'SHOP_BUY']);
    expect(coins()).toBe(10);
  });

  it('keeps drag and drop working beside the card: the drop still buys', async () => {
    await mountShop({ coins: 1000 });
    await select('shop-goods-cell-0');

    await drag(byId('shop-goods-cell-0'), [bagCell(5)]);
    await drop();

    expect(coins()).toBe(1000 - POTION_PRICE * 4);
    expect(bagKeys()[5]).toBe(`${K.HEALTH_BOTTLE}x4`);
  });

  it('closing the board clears the selection', async () => {
    await mountShop({ coins: 1000 });
    await select('shop-goods-cell-0');

    closeShopBoard();
    await nextTick();

    expect(shopSelection.list).toBeNull();
  });

  it('paid new goods clear the selection even when the same item lands in the same cell', async () => {
    await mountShop({ coins: 1000, will: 50 });
    await select('shop-goods-cell-0');

    byId('shop-refresh').click();
    await vi.waitFor(() => expect(shopCommands()).toEqual(['SHOP_REFRESH']));
    await settleInventorySync();
    await nextTick();

    expect(shopSelection.list).toBeNull();
    expect(byId('shop-card').dataset.itemKey).toBeUndefined();
  });
});

describe('a bought-out good stays on the shelf as Sold out', () => {
  beforeEach(() => mountShop({ coins: 1000 }));

  async function buyAll() {
    byId('shop-goods-cell-0').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await settleShopDeal();
    await nextTick();
  }

  it('keeps the item at 30% with a Sold out label and no price, instead of an empty cell', async () => {
    await buyAll();

    const cell = byId('shop-goods-cell-0');
    expect(cell.dataset.sold).toBe('true');
    expect(cell.dataset.itemKey).toBe(K.HEALTH_BOTTLE);
    expect(cell.classList.contains('is-sold')).toBe(true);
    expect(
      cell.parentElement?.querySelector('[data-testid="shop-sold-label"]')?.textContent?.trim(),
    ).toBe('Sold');
    expect(view.host!.querySelector('[data-testid="shop-price-0"]')).toBeNull();
    expect(cell.getAttribute('tabindex')).toBe('-1');
    expect(cell.getAttribute('role')).toBeNull();
  });

  it('cannot be selected, dragged or bought again', async () => {
    await buyAll();
    const spent = coins();
    sentCommands.length = 0;

    byId('shop-goods-cell-0').dispatchEvent(pointer('click', {}));
    await drag(byId('shop-goods-cell-0'), [bagCell(5)]);
    byId('shop-goods-cell-0').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    byId('shop-goods-cell-0').dispatchEvent(pointer('contextmenu', {}));
    await settleShopDeal();
    await nextTick();

    expect(shopDrag.active).toBe(false);
    expect(byId('shop-card').dataset.itemKey).toBeUndefined();
    expect(shopCommands()).toEqual([]);
    expect(coins()).toBe(spent);
  });

  it('a half-bought stack is not sold out yet', async () => {
    await drag(byId('shop-goods-cell-0'), [bagCell(5)], { shift: true });
    await drop();

    expect(byId('shop-goods-cell-0').dataset.sold).toBeUndefined();
    expect(ilva().goods[0]).toEqual({ key: K.HEALTH_BOTTLE, amount: 2 });
  });
});
