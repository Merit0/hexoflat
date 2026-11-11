import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { TRADERS } from '@hexoflat/engine/content/traders.content';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import { sellUnitPrice } from '@hexoflat/engine/trade/trader-view';
import { shopDrag } from '@/composables/shop-drag-state';
import { settleShopDeal } from '@/composables/use-shop-drag';
import { REFRESH_CONFIRM_MS } from '@/composables/use-shop-refresh';
import { settleInventorySync } from '@/services/inventory/inventory-sync';
import { inventorySession } from '@/services/inventory/inventory-session';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { useTraderStore } from '@/stores/trader-store';
import {
  view,
  byId,
  ghostBadge,
  coins,
  ilva,
  bagKeys,
  message,
  shopCommands,
  pointer,
  bagCell,
  bagCellWith,
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

describe('buying with the pointer', () => {
  beforeEach(() => mountShop({ coins: 1000 }));

  it('buys a good onto the bag cell it is dropped on and pays the engine price', async () => {
    await drag(byId('shop-goods-cell-0'), [bagCell(5), byId('stash-bag-pane')]);

    expect(shopDrag.active).toBe(true);
    expect(byId('shop-goods-cell-0').classList.contains('is-lifted')).toBe(true);
    expect(bagCell(5).classList.contains('is-valid')).toBe(true);
    expect(ghostBadge()?.textContent).toBe(`Buy 4 · ${POTION_PRICE * 4}`);
    expect(byId('shop-hint').textContent).toContain('Release over a bag cell');

    window.dispatchEvent(pointer('pointerup', { clientX: 60, clientY: 80 }));
    expect(coins()).toBe(1000);
    expect(ilva().goods[0]).toEqual({ key: K.HEALTH_BOTTLE, amount: 4 });

    await settleShopDeal();
    await nextTick();
    expect(shopCommands()).toEqual(['SHOP_BUY']);
    expect(bagKeys()[5]).toBe(`${K.HEALTH_BOTTLE}x4`);
    expect(coins()).toBe(1000 - POTION_PRICE * 4);
    expect(ilva().goods[0]).toEqual({ key: K.HEALTH_BOTTLE, amount: 4, sold: true });
    expect(bagCell(5).classList.contains('is-landed')).toBe(true);
    expect(byId('shop-hint').textContent).toContain('Drag goods into the bag');
  });

  it('buys into the first free cell when dropped on the bag panel and lights that cell first', async () => {
    const landing = bagKeys().findIndex((cell) => cell === null);
    await drag(byId('shop-goods-cell-1'), [byId('stash-bag-pane')]);

    expect(bagCell(landing).classList.contains('is-next')).toBe(true);
    expect(byId('stash-bag-pane').classList.contains('zone-ok')).toBe(true);
    expect(ghostBadge()?.textContent).toBe(`Buy · ${SWORD_PRICE}`);

    await drop();
    expect(bagKeys()[landing]).toBe(`${K.SWORD}x1`);
    expect(coins()).toBe(1000 - SWORD_PRICE);
  });

  it('takes half of the stack when Shift is held at the press', async () => {
    await drag(byId('shop-goods-cell-0'), [byId('stash-bag-pane')], { shift: true });
    expect(ghostBadge()?.textContent).toBe(`Buy 2 · ${POTION_PRICE * 2}`);
    expect(byId('shop-hint').textContent).toContain('half of the stack');

    await drop();
    expect(coins()).toBe(1000 - POTION_PRICE * 2);
    expect(ilva().goods[0]).toEqual({ key: K.HEALTH_BOTTLE, amount: 2 });
  });

  it('does nothing when the good is released over the goods row', async () => {
    await drag(byId('shop-goods-cell-0'), [byId('shop-goods-cell-3'), byId('shop-goods-pane')]);
    expect(ghostBadge()).toBeNull();

    await drop();
    expect(shopCommands()).toEqual([]);
    expect(coins()).toBe(1000);
  });

  it('cancels with Escape and keeps the shop open', async () => {
    await drag(byId('shop-goods-cell-0'), [bagCell(5)]);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await drop();

    expect(shopDrag.active).toBe(false);
    expect(shopCommands()).toEqual([]);
    expect(useTraderStore().isOpen).toBe(true);
  });
});

describe('a refused deal changes nothing and says why', () => {
  it('cannot afford: red ghost, red cell, coins warning with the price, no command', async () => {
    await mountShop({ coins: 100 });
    await drag(byId('shop-goods-cell-1'), [bagCell(5)]);

    expect(ghostBadge()?.textContent).toBe("Can't afford");
    expect(bagCell(5).classList.contains('is-invalid')).toBe(true);

    await drop();
    expect(shopCommands()).toEqual([]);
    expect(coins()).toBe(100);
    expect(ilva().goods[1]).toEqual({ key: K.SWORD, amount: 1 });
    expect(message()).toBe('Not enough coins.');
    expect(useHeroToolStore().actionMessageIcon).toBe('coins');
    expect(useHeroToolStore().actionMessageWillCost).toBe(SWORD_PRICE);
    expect(bagCell(5).classList.contains('is-shake')).toBe(true);
  });

  it('the trader does not buy coins', async () => {
    await mountShop({ coins: 100 });
    await drag(bagCellWith(K.COINS), [byId('shop-trader-banner')]);

    expect(ghostBadge()?.textContent).toBe('Not interested');
    expect(byId('shop-trader-banner').classList.contains('zone-bad')).toBe(true);

    await drop();
    expect(shopCommands()).toEqual([]);
    expect(coins()).toBe(100);
    expect(message()).toBe('The trader is not interested in that.');
  });
});

describe('selling and buying back', () => {
  beforeEach(() => mountShop({ coins: 10 }));

  async function giveSword() {
    useHeroInventoryStore().putToInventory(K.SWORD, 1);
    await settleInventorySync();
    await nextTick();
  }

  it('sells a bag item dropped on the trader and lists it in BUYBACK at the sale price', async () => {
    await giveSword();
    const sale = sellUnitPrice(TRADERS.ilva, K.SWORD)!;
    await drag(bagCellWith(K.SWORD), [byId('shop-trader-banner')]);

    expect(ghostBadge()?.textContent).toBe(`Sell +${sale}`);
    expect(byId('shop-trader-banner').classList.contains('zone-ok')).toBe(true);
    expect(bagCellWith(K.SWORD).classList.contains('is-lifted')).toBe(true);

    await drop();
    expect(shopCommands()).toEqual(['SHOP_SELL']);
    expect(coins()).toBe(10 + sale);
    expect(bagCellWith(K.SWORD)).toBeNull();
    expect(byId('shop-buyback-cell-0').dataset.itemKey).toBe(K.SWORD);
  });

  it('sells onto the goods and the buyback rows too', async () => {
    await giveSword();
    await drag(bagCellWith(K.SWORD), [byId('shop-goods-cell-4'), byId('shop-goods-pane')]);
    expect(byId('shop-goods-pane').classList.contains('zone-ok')).toBe(true);
    await drop();
    expect(shopCommands()).toEqual(['SHOP_SELL']);
  });

  it('a double click sells, a double click on BUYBACK buys it back for the same coins', async () => {
    await giveSword();
    bagCellWith(K.SWORD).dispatchEvent(pointer('dblclick', {}));
    await settleShopDeal();
    await nextTick();
    expect(coins()).toBe(10 + sellUnitPrice(TRADERS.ilva, K.SWORD)!);

    byId('shop-buyback-cell-0').dispatchEvent(pointer('dblclick', {}));
    await settleShopDeal();
    await nextTick();
    expect(shopCommands()).toEqual(['SHOP_SELL', 'SHOP_BUY']);
    expect(coins()).toBe(10);
    expect(bagCellWith(K.SWORD)).not.toBeNull();
    expect(view.host!.querySelector('[data-testid="shop-buyback-pane"]')).toBeNull();
  });

  it('drags a BUYBACK item back into the bag with its own label', async () => {
    await giveSword();
    bagCellWith(K.SWORD).dispatchEvent(pointer('contextmenu', {}));
    await settleShopDeal();
    await nextTick();
    const sale = sellUnitPrice(TRADERS.ilva, K.SWORD)!;

    await drag(byId('shop-buyback-cell-0'), [byId('stash-bag-pane')]);
    expect(ghostBadge()?.textContent).toBe(`Buy back · ${sale}`);
    await drop();
    expect(coins()).toBe(10);
  });
});

describe('quick buy from the keyboard and the right button', () => {
  beforeEach(() => mountShop({ coins: 1000 }));

  it('Enter on a good buys the whole stack into the bag', async () => {
    byId('shop-goods-cell-0').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await settleShopDeal();
    expect(coins()).toBe(1000 - POTION_PRICE * 4);
    expect(bagKeys()).toContain(`${K.HEALTH_BOTTLE}x4`);
  });

  it('the right button with Shift buys half', async () => {
    byId('shop-goods-cell-0').dispatchEvent(pointer('contextmenu', { shiftKey: true }));
    await settleShopDeal();
    expect(ilva().goods[0]).toEqual({ key: K.HEALTH_BOTTLE, amount: 2 });
  });

  it('a second quick buy while the first is on its way is ignored', async () => {
    byId('shop-goods-cell-0').dispatchEvent(pointer('dblclick', {}));
    byId('shop-goods-cell-0').dispatchEvent(pointer('dblclick', {}));
    await settleShopDeal();
    expect(shopCommands()).toEqual(['SHOP_BUY']);
  });

  it('arrow keys move focus through the two rows of four and Home/End jump to the ends', () => {
    byId('shop-goods-cell-0').focus();
    byId('shop-goods-cell-0').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    expect(document.activeElement).toBe(byId('shop-goods-cell-1'));
    byId('shop-goods-cell-1').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', bubbles: true }),
    );
    expect(document.activeElement).toBe(byId('shop-goods-cell-7'));
  });

  it('ArrowDown moves to the cell below in the second row and ArrowUp comes back', () => {
    byId('shop-goods-cell-1').focus();
    byId('shop-goods-cell-1').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    expect(document.activeElement).toBe(byId('shop-goods-cell-5'));
    byId('shop-goods-cell-5').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
    );
    expect(document.activeElement).toBe(byId('shop-goods-cell-1'));
  });
});

describe('New goods asks for a second click', () => {
  const refresh = () => byId('shop-refresh');
  const will = () => inventorySession.knowledge?.current;

  it('the first click only asks, the second pays the Will and rolls new goods', async () => {
    await mountShop({ will: 50 });
    const serial = ilva().serial;

    refresh().click();
    await nextTick();
    expect(refresh().dataset.confirm).toBe('true');
    expect(message()).toBe('Pay 20 Will for new goods? Click again to confirm.');
    expect(shopCommands()).toEqual([]);

    refresh().click();
    await vi.waitFor(() => expect(shopCommands()).toEqual(['SHOP_REFRESH']));
    await settleInventorySync();
    await nextTick();
    expect(will()).toBe(30);
    expect(ilva().serial).toBe(serial + 1);
    expect(refresh().dataset.confirm).toBe('false');
    expect(byId('shop-refresh-price').dataset.price).toBe('40');
  });

  it('warns that the buyback row will be lost only when it is not empty', async () => {
    await mountShop({ will: 50, buyback: [{ key: K.SWORD, amount: 1, unitPrice: 200 }] });
    refresh().click();
    await nextTick();
    expect(message()).toBe(
      'Pay 20 Will for new goods? Click again to confirm. The buyback row will be lost.',
    );
  });

  it('goes back after 3 seconds, Escape or a click elsewhere', async () => {
    vi.useFakeTimers();
    await mountShop({ will: 50 });

    refresh().click();
    await nextTick();
    vi.advanceTimersByTime(REFRESH_CONFIRM_MS);
    await nextTick();
    expect(refresh().dataset.confirm).toBe('false');

    refresh().click();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await nextTick();
    expect(refresh().dataset.confirm).toBe('false');
    expect(useTraderStore().isOpen).toBe(true);

    refresh().click();
    byId('shop-trader-banner').dispatchEvent(pointer('pointerdown', { button: 0 }));
    await nextTick();
    expect(refresh().dataset.confirm).toBe('false');
    expect(shopCommands()).toEqual([]);
  });

  it('with too little Will it refuses at once without asking', async () => {
    await mountShop({ will: 19 });
    refresh().click();
    await nextTick();
    expect(refresh().dataset.confirm).toBe('false');
    expect(message()).toBe('New goods cost 20 Will. Not enough Will.');
    expect(useHeroToolStore().actionMessageIcon).toBe('will');
    expect(shopCommands()).toEqual([]);
  });
});
