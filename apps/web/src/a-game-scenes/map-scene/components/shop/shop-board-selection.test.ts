import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import { shopDrag } from '@/composables/shop-drag-state';
import { shopSelection } from '@/composables/shop-selection';
import { closeShopBoard } from '@/composables/use-shop-board';
import { settleShopDeal } from '@/composables/use-shop-drag';
import { settleInventorySync } from '@/services/inventory/inventory-sync';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { sentCommands } from '@/test-support/fake-player-server';
import {
  view,
  byId,
  coins,
  ilva,
  bagKeys,
  message,
  shopCommands,
  pointer,
  bagCell,
  mountShop,
  drag,
  drop,
  registerShopCleanup,
  POTION_PRICE,
  SWORD_PRICE,
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

  it('shows no card until something is clicked, then names the item and its stack price', async () => {
    await mountShop({ coins: 1000 });
    expect(view.host!.querySelector('[data-testid="shop-selection"]')).toBeNull();

    await select('shop-goods-cell-0');

    expect(byId('shop-selection').dataset.itemKey).toBe(K.HEALTH_BOTTLE);
    expect(byId('shop-selection-name').textContent).toBeTruthy();
    expect(byId('shop-selection-amount').textContent).toContain('4');
    expect(byId('shop-selection-price').dataset.price).toBe(String(POTION_PRICE * 4));
    expect(byId('shop-goods-cell-0').dataset.selected).toBe('true');
    expect(byId('shop-buy').textContent?.trim()).toBe('Buy');
    expect(shopCommands()).toEqual([]);
  });

  it('Buy purchases the whole stack into the bag, and the card goes with the emptied cell', async () => {
    await mountShop({ coins: 1000 });
    await select('shop-goods-cell-0');

    byId('shop-buy').click();
    await settleShopDeal();
    await nextTick();

    expect(shopCommands()).toEqual(['SHOP_BUY']);
    expect(coins()).toBe(1000 - POTION_PRICE * 4);
    expect(bagKeys()).toContain(`${K.HEALTH_BOTTLE}x4`);
    expect(ilva().goods[0]).toEqual({ key: K.HEALTH_BOTTLE, amount: 4, sold: true });
    expect(view.host!.querySelector('[data-testid="shop-selection"]')).toBeNull();
  });

  it('selecting another good moves the card and the highlight', async () => {
    await mountShop({ coins: 1000 });
    await select('shop-goods-cell-0');

    await select('shop-goods-cell-1');

    expect(byId('shop-selection').dataset.itemKey).toBe(K.SWORD);
    expect(byId('shop-selection-price').dataset.price).toBe(String(SWORD_PRICE));
    expect(byId('shop-goods-cell-0').dataset.selected).toBe('false');
    expect(byId('shop-goods-cell-1').dataset.selected).toBe('true');
  });

  it('too few coins: the price is red, Buy still answers with the price and changes nothing', async () => {
    await mountShop({ coins: 100 });
    await select('shop-goods-cell-1');

    expect(byId('shop-selection-price').dataset.affordable).toBe('false');
    byId('shop-buy').click();
    await settleShopDeal();
    await nextTick();

    expect(shopCommands()).toEqual([]);
    expect(coins()).toBe(100);
    expect(message()).toBe('Not enough coins.');
    expect(useHeroToolStore().actionMessageWillCost).toBe(SWORD_PRICE);
    expect(byId('shop-selection')).toBeTruthy();
  });

  it('a BUYBACK item is selected too and its button buys it back at the sale price', async () => {
    await mountShop({ coins: 100, buyback: [{ key: K.SWORD, amount: 1, unitPrice: 200 }] });
    await select('shop-buyback-cell-0');

    expect(byId('shop-selection').dataset.list).toBe('buyback');
    expect(byId('shop-selection-price').dataset.price).toBe('200');
    expect(byId('shop-buy').textContent?.trim()).toBe('Buy back');
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
    await nextTick();
    byId('shop-refresh').click();
    await vi.waitFor(() => expect(shopCommands()).toEqual(['SHOP_REFRESH']));
    await settleInventorySync();
    await nextTick();

    expect(shopSelection.list).toBeNull();
    expect(view.host!.querySelector('[data-testid="shop-selection"]')).toBeNull();
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
    expect(cell.querySelector('[data-testid="shop-sold-label"]')?.textContent?.trim()).toBe(
      'Sold out',
    );
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
    expect(view.host!.querySelector('[data-testid="shop-selection"]')).toBeNull();
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
