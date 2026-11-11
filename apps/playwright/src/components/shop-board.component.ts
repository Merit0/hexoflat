import { expect, type Locator } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';
import { pointerDrag } from '@components/pointer-drag';

const POLL = { timeout: 5_000, intervals: [100] };

export type ShopCellContent = {
  key: string;
  amount: number;
  sold?: boolean;
  discountPercent?: number;
  wasted?: boolean;
} | null;
export type ShopBuybackContent = { key: string; amount: number; unitPrice: number } | null;
export type ShopTraderFixture = {
  goods?: ShopCellContent[];
  buyback?: ShopBuybackContent[];
  trips?: number;
};
export type ShopCellShows = { key: string; amount: number; price: number };
export type SellTarget = 'trader' | 'goods' | 'buyback';

/**
 * The camp trader's board that replaces the hero panel after OPEN on the stall (apps/web's
 * shop-board.vue). The BAG at the bottom is the stash's own bag pane, so its cells keep the
 * `stash-bag-cell-` ids. Stored state is read, and goods are arranged, through the app's test
 * hooks; drags use the real pointer path.
 */
export class ShopBoardComponent extends BaseComponent {
  private get board(): Locator {
    return this.page.getByTestId('shop-board');
  }

  private goodsCell(index: number): Locator {
    return this.page.getByTestId(`shop-goods-cell-${index}`);
  }

  private buybackCell(index: number): Locator {
    return this.page.getByTestId(`shop-buyback-cell-${index}`);
  }

  private bagCellWith(itemKey: string): Locator {
    return this.page
      .locator(`[data-testid^="stash-bag-cell-"][data-item-key="${itemKey}"]`)
      .first();
  }

  private get freeBagCell(): Locator {
    return this.page.locator('[data-testid^="stash-bag-cell-"]:not([data-item-key])').first();
  }

  private get bagPaneDropPoint(): Locator {
    return this.page.getByTestId('stash-load-value');
  }

  private get refreshButton(): Locator {
    return this.page.getByTestId('shop-refresh');
  }

  private sellTarget(target: SellTarget): Locator {
    const ids: Record<SellTarget, string> = {
      trader: 'shop-trader-banner',
      goods: 'shop-goods-pane',
      buyback: 'shop-buyback-pane',
    };
    return this.page.getByTestId(ids[target]);
  }

  private async openTab(tab: 'goods' | 'buyback'): Promise<void> {
    const button = this.page.getByTestId(`shop-tab-${tab}`);
    if ((await button.getAttribute('aria-selected')) !== 'true') await button.click();
    await expect(button).toHaveAttribute('aria-selected', 'true');
  }

  async verifyIsOpen(): Promise<void> {
    await expect(this.board).toBeVisible();
  }

  async verifyIsClosed(): Promise<void> {
    await expect(this.board).toBeHidden();
  }

  async close(): Promise<void> {
    await this.page.getByTestId('shop-close').click();
  }

  async pressEscape(): Promise<void> {
    await this.page.keyboard.press('Escape');
  }

  async releasePointer(): Promise<void> {
    await this.page.mouse.up();
  }

  async verifyTraderName(pattern: RegExp): Promise<void> {
    await expect(this.page.getByTestId('shop-trader-name')).toHaveText(pattern);
  }

  async verifySellRate(pattern: RegExp): Promise<void> {
    await expect(this.page.getByTestId('shop-sell-rate')).toHaveText(pattern);
  }

  async verifyCoinsOnBanner(coins: number): Promise<void> {
    await expect(this.page.getByTestId('shop-coins')).toHaveAttribute('data-coins', String(coins));
  }

  async verifyGoodsCellShows(index: number, expected: ShopCellShows | null): Promise<void> {
    await this.openTab('goods');
    const cell = this.goodsCell(index);
    if (!expected) {
      await expect(cell).not.toHaveAttribute('data-item-key', /.+/);
      await expect(this.page.getByTestId(`shop-price-${index}`)).toHaveCount(0);
      return;
    }
    await expect(cell).toHaveAttribute('data-item-key', expected.key);
    await expect(cell).toHaveAttribute('data-item-amount', String(expected.amount));
    await expect(cell).toHaveAttribute('data-price', String(expected.price));
    await expect(this.page.getByTestId(`shop-price-${index}`)).toHaveText(String(expected.price));
  }

  async readGoodsIconTilts(): Promise<string[]> {
    await this.openTab('goods');
    await expect
      .poll(
        () =>
          this.page.evaluate(() =>
            Array.from(document.querySelectorAll('[data-testid^="shop-goods-cell-"] .icon')).some(
              (icon) => icon.getAnimations().length > 0,
            ),
          ),
        POLL,
      )
      .toBe(false);
    return this.page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-testid^="shop-goods-cell-"]')).map((cell) => {
        const icon = cell.querySelector('.icon');
        return icon ? getComputedStyle(icon).transform : 'none';
      }),
    );
  }

  async verifyGoodsCellSoldOut(index: number, key: string): Promise<void> {
    await this.openTab('goods');
    const cell = this.goodsCell(index);
    await expect(cell).toHaveAttribute('data-sold', 'true');
    await expect(cell).toHaveAttribute('data-item-key', key);
    const label = cell.locator('xpath=..').getByTestId('shop-sold-label');
    await expect(label).toBeVisible();
    await expect(label).toHaveText(/^\s*(sold|продано)\s*$/i);
    await expect(this.page.getByTestId(`shop-price-${index}`)).toHaveCount(0);
    await expect(cell).not.toHaveAttribute('role', 'button');
  }

  async verifyGoodsCellDimmed(index: number): Promise<void> {
    await this.openTab('goods');
    const opacity = await this.goodsCell(index)
      .locator('> *')
      .first()
      .evaluate((node) => getComputedStyle(node).opacity);
    expect(Number(opacity)).toBeCloseTo(0.3, 2);
  }

  async verifyGoodsPriceAffordable(index: number, affordable: boolean): Promise<void> {
    await this.openTab('goods');
    await expect(this.page.getByTestId(`shop-price-${index}`)).toHaveAttribute(
      'data-affordable',
      String(affordable),
    );
  }

  async verifyGoodsCellCount(count: number): Promise<void> {
    await this.openTab('goods');
    await expect(this.page.locator('[data-testid^="shop-goods-cell-"]')).toHaveCount(count);
  }

  async verifyBuybackCellShows(index: number, expected: ShopCellShows): Promise<void> {
    await this.openTab('buyback');
    const cell = this.buybackCell(index);
    await expect(cell).toHaveAttribute('data-item-key', expected.key);
    await expect(cell).toHaveAttribute('data-item-amount', String(expected.amount));
    await expect(cell).toHaveAttribute('data-price', String(expected.price));
  }

  async verifyBuybackCount(count: number): Promise<void> {
    await expect(this.page.getByTestId('shop-tab-buyback')).toHaveAttribute(
      'data-count',
      String(count),
    );
  }

  async dragGoodsToBagCell(index: number, shift = false): Promise<void> {
    await this.openTab('goods');
    await pointerDrag(this.page, this.goodsCell(index), this.freeBagCell, { shift });
  }

  async dragGoodsToBagPane(index: number, shift = false): Promise<void> {
    await this.openTab('goods');
    await pointerDrag(this.page, this.goodsCell(index), this.bagPaneDropPoint, { shift });
  }

  async holdGoodsOverBagCell(index: number): Promise<void> {
    await this.openTab('goods');
    await pointerDrag(this.page, this.goodsCell(index), this.freeBagCell, { release: false });
  }

  async dragBuybackToBagCell(index: number): Promise<void> {
    await this.openTab('buyback');
    await pointerDrag(this.page, this.buybackCell(index), this.freeBagCell);
  }

  async dragBagItemTo(itemKey: string, target: SellTarget, shift = false): Promise<void> {
    if (target !== 'trader') await this.openTab(target);
    await pointerDrag(this.page, this.bagCellWith(itemKey), this.sellTarget(target), { shift });
  }

  async selectGoods(index: number): Promise<void> {
    await this.openTab('goods');
    await this.goodsCell(index).click();
  }

  async selectBuyback(index: number): Promise<void> {
    await this.openTab('buyback');
    await this.buybackCell(index).click();
  }

  async clickBuy(): Promise<void> {
    await this.page.getByTestId('shop-card-action').click();
  }

  async verifySelectionShows(expected: {
    list: 'goods' | 'buyback';
    key: string;
    price: number;
    affordable: boolean;
    amount?: number;
  }): Promise<void> {
    const card = this.page.getByTestId('shop-card');
    await expect(card).toHaveAttribute(
      'data-mode',
      expected.list === 'goods' ? 'buying' : 'buyback',
    );
    await expect(card).toHaveAttribute('data-item-key', expected.key);
    await expect(this.page.getByTestId('shop-card-name')).toHaveText(/\S+/);
    const action = this.page.getByTestId('shop-card-action');
    if (expected.affordable) await expect(action).toBeEnabled();
    else await expect(action).toBeDisabled();
    if (expected.list === 'buyback') await expect(action).toContainText(String(expected.price));
  }

  async verifyBuyButtonReads(pattern: RegExp): Promise<void> {
    await expect(this.page.getByTestId('shop-card-action')).toHaveText(pattern);
  }

  async verifyNoSelection(): Promise<void> {
    await expect(this.page.getByTestId('shop-card')).not.toHaveAttribute('data-item-key', /.+/);
  }

  async verifyNoReason(): Promise<void> {
    await expect(this.page.getByTestId('shop-card-reason')).toHaveCount(0);
  }

  async selectBagItem(itemKey: string): Promise<void> {
    await this.bagCellWith(itemKey).click();
  }

  async verifyTradingCard(key: string, pays: number): Promise<void> {
    const card = this.page.getByTestId('shop-card');
    await expect(card).toHaveAttribute('data-mode', 'trading');
    await expect(card).toHaveAttribute('data-item-key', key);
    await expect(this.page.getByTestId('shop-card-trade-price').locator('b')).toHaveAttribute(
      'data-price',
      String(pays),
    );
    await expect(this.bagCellWith(key).getByTestId('shop-bag-sum')).toHaveAttribute(
      'data-sum',
      String(pays),
    );
  }

  async verifyOfferBadge(index: number, percent: number | null): Promise<void> {
    await this.openTab('goods');
    const badge = this.page.getByTestId(`shop-offer-badge-${index}`);
    if (percent === null) await expect(badge).toHaveCount(0);
    else await expect(badge).toContainText(String(percent));
  }

  async verifyOfferWasted(index: number): Promise<void> {
    await this.openTab('goods');
    const cell = this.goodsCell(index);
    await expect(cell).toHaveAttribute('data-wasted', 'true');
    await expect(cell.locator('xpath=..').getByTestId('shop-wasted-label')).toBeVisible();
    await expect(cell.locator('xpath=..').getByTestId('shop-sold-label')).toHaveCount(0);
  }

  async verifyPriceInputShown(shown: boolean): Promise<void> {
    await expect(this.page.getByTestId('shop-card-price-input')).toHaveCount(shown ? 1 : 0);
  }

  async enterOwnPrice(price: string): Promise<void> {
    await this.page.getByTestId('shop-card-price-input').fill(price);
  }

  async verifyBuyDisabled(disabled: boolean): Promise<void> {
    const action = this.page.getByTestId('shop-card-action');
    if (disabled) await expect(action).toBeDisabled();
    else await expect(action).toBeEnabled();
  }

  async verifyToastText(pattern: RegExp): Promise<void> {
    await expect(this.page.getByTestId('shop-toast-text')).toHaveText(pattern);
  }

  async verifyCardHidesPrice(price: number): Promise<void> {
    await expect(this.page.getByTestId('shop-card')).not.toContainText(String(price));
  }

  async pressUndoOnToast(): Promise<void> {
    await this.page.getByTestId('shop-toast-undo').click();
  }

  async pickMaxQuantity(): Promise<void> {
    await this.page.getByTestId('shop-qty-max').click();
  }

  async verifyQuantity(qty: number): Promise<void> {
    await expect(this.page.getByTestId('shop-qty-value')).toHaveAttribute('data-qty', String(qty));
  }

  async verifyGoodsCellSelected(index: number, selected: boolean): Promise<void> {
    await this.openTab('goods');
    await expect(this.goodsCell(index)).toHaveAttribute('data-selected', String(selected));
  }

  async doubleClickGoods(index: number): Promise<void> {
    await this.openTab('goods');
    await this.goodsCell(index).dblclick();
  }

  async pressEnterOnGoods(index: number): Promise<void> {
    await this.openTab('goods');
    await this.goodsCell(index).focus();
    await this.page.keyboard.press('Enter');
  }

  async rightClickBuyback(index: number): Promise<void> {
    await this.openTab('buyback');
    await this.buybackCell(index).click({ button: 'right' });
  }

  async rightClickBagItem(itemKey: string): Promise<void> {
    await this.bagCellWith(itemKey).click({ button: 'right' });
  }

  async doubleClickBagItem(itemKey: string): Promise<void> {
    await this.bagCellWith(itemKey).dblclick();
  }

  async verifyDragLabel(label: string): Promise<void> {
    await expect(this.page.getByTestId('shop-drag-badge')).toHaveAttribute('data-label', label);
  }

  async verifyNoDragGhost(): Promise<void> {
    await expect(this.page.getByTestId('shop-drag-ghost')).toHaveCount(0);
  }

  async clickRefresh(): Promise<void> {
    await this.refreshButton.click();
  }

  async verifyRefreshIsAnIconButton(): Promise<void> {
    await expect(this.refreshButton).toHaveAttribute('aria-label', /refresh|оновити/i);
    await expect(this.refreshButton).toHaveText('');
  }

  async hoverRefresh(): Promise<void> {
    await this.refreshButton.hover();
  }

  async verifyRefreshTooltipShowsCost(cost: number): Promise<void> {
    const tip = this.page.getByTestId('shop-refresh-price');
    await this.page.mouse.move(5, 5);
    await expect(tip).toBeHidden();
    await this.refreshButton.hover();
    await expect(tip).toBeVisible();
    await expect(tip).toHaveAttribute('data-price', String(cost));
    await expect(tip).toContainText(String(cost));
    await expect(tip.locator('img')).toBeVisible();
    await this.page.mouse.move(5, 5);
    await expect(tip).toBeHidden();
  }

  async verifyRefreshPrice(price: number): Promise<void> {
    await expect(this.page.getByTestId('shop-refresh-price')).toHaveAttribute(
      'data-price',
      String(price),
    );
  }

  async verifyRefreshAffordable(affordable: boolean): Promise<void> {
    await expect(this.refreshButton).toHaveAttribute('data-affordable', String(affordable));
  }

  async givenTrader(fixture: ShopTraderFixture): Promise<void> {
    await this.page.evaluate((f) => window.__HEXOFLAT_TEST__!.setTrader(f), fixture);
  }

  async givenBag(cells: ShopCellContent[]): Promise<void> {
    await this.page.evaluate(async (fixture) => {
      window.__HEXOFLAT_TEST__!.setBag(fixture);
      await window.__HEXOFLAT_TEST__!.settleInventorySync();
    }, cells);
  }

  async givenWill(will: number): Promise<void> {
    await this.page.evaluate(async (n) => {
      window.__HEXOFLAT_TEST__!.setWill(n);
      await window.__HEXOFLAT_TEST__!.settleInventorySync();
    }, will);
  }

  async verifyWill(will: number): Promise<void> {
    await expect
      .poll(() => this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getKnowledge()?.current), POLL)
      .toBe(will);
  }

  async verifyWalletCoins(coins: number): Promise<void> {
    await expect
      .poll(() => this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getWalletCoins()), POLL)
      .toBe(coins);
  }

  async verifyTraderGoods(goods: ShopCellContent[]): Promise<void> {
    await expect
      .poll(
        () => this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getTrader()?.goods.slice(0, 8)),
        POLL,
      )
      .toEqual(goods);
  }

  async verifyTraderBuyback(buyback: ShopBuybackContent[]): Promise<void> {
    await expect
      .poll(
        () => this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getTrader()?.buyback.slice(0, 7)),
        POLL,
      )
      .toEqual(buyback);
  }

  async verifyTraderSerial(serial: number): Promise<void> {
    await expect
      .poll(() => this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getTrader()?.serial), POLL)
      .toBe(serial);
  }

  async verifyTraderRefreshPrice(price: number): Promise<void> {
    await expect
      .poll(
        () => this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getTrader()?.refreshPrice),
        POLL,
      )
      .toBe(price);
  }

  async verifyServedGoodsHoldTheGuaranteedItem(
    key: string,
    min: number,
    max: number,
    slots: number,
  ): Promise<void> {
    const goods = await this.page.evaluate(
      () => window.__HEXOFLAT_TEST__!.getTrader()?.goods ?? [],
    );
    expect(goods).toHaveLength(slots);
    const guaranteed = goods.find((cell) => cell?.key === key);
    expect(guaranteed, `the trader always stocks "${key}"`).toBeTruthy();
    expect(guaranteed!.amount).toBeGreaterThanOrEqual(min);
    expect(guaranteed!.amount).toBeLessThanOrEqual(max);
  }

  async verifyBagAmount(itemKey: string, amount: number): Promise<void> {
    await expect
      .poll(() => this.bagStacks(itemKey).then((stacks) => stacks.reduce((a, b) => a + b, 0)), POLL)
      .toBe(amount);
  }

  async verifyBagStacks(itemKey: string, stacks: number[]): Promise<void> {
    await expect.poll(() => this.bagStacks(itemKey), POLL).toEqual(stacks);
  }

  async verifyOpenTraderIs(key: string | null): Promise<void> {
    await expect
      .poll(() => this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getOpenTrader()), POLL)
      .toBe(key);
  }

  private bagStacks(itemKey: string): Promise<number[]> {
    return this.page.evaluate(
      (key) =>
        window
          .__HEXOFLAT_TEST__!.getBag()
          .filter((cell) => cell?.key === key)
          .map((cell) => cell!.amount),
      itemKey,
    );
  }
}
