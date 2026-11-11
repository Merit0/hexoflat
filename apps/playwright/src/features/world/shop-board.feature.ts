import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { GUARANTEED_GOOD, TRADER_GOODS_SLOTS } from '@config/test-data';
import type {
  SellTarget,
  ShopBuybackContent,
  ShopCellContent,
  ShopCellShows,
  ShopTraderFixture,
} from '@components/shop-board.component';

export type { SellTarget, ShopBuybackContent, ShopCellContent, ShopCellShows, ShopTraderFixture };

/** What a player does and sees on the open trader board: buying, selling, buyback, new goods. */
export class ShopBoardFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  private get board() {
    return this.campingMap.shopBoard;
  }

  async givenGoods(goods: ShopCellContent[]): Promise<void> {
    await this.step('Arrange the trader goods', () => this.board.givenTrader({ goods }));
  }

  async givenTrader(fixture: ShopTraderFixture): Promise<void> {
    await this.step('Arrange the trader state', () => this.board.givenTrader(fixture));
  }

  async givenBag(cells: ShopCellContent[]): Promise<void> {
    await this.step('Arrange the bag', () => this.board.givenBag(cells));
  }

  async givenWill(will: number): Promise<void> {
    await this.step(`Arrange ${will} Will`, () => this.board.givenWill(will));
  }

  async verifyBanner(): Promise<void> {
    await this.step('Verify the banner names the trader and the sell rate', async () => {
      await this.board.verifyTraderName(/\S+/);
      await this.board.verifySellRate(/40\s*%/);
    });
  }

  async verifyServedGoods(): Promise<void> {
    await this.step('Verify the server stocked the guaranteed item in eight slots', async () => {
      await this.board.verifyGoodsCellCount(TRADER_GOODS_SLOTS);
      await this.board.verifyServedGoodsHoldTheGuaranteedItem(
        GUARANTEED_GOOD.key,
        GUARANTEED_GOOD.min,
        GUARANTEED_GOOD.max,
        TRADER_GOODS_SLOTS,
      );
    });
  }

  async verifyGoodsCell(index: number, expected: ShopCellShows | null): Promise<void> {
    await this.step(`Verify goods cell ${index} shows ${JSON.stringify(expected)}`, () =>
      this.board.verifyGoodsCellShows(index, expected),
    );
  }

  async verifyGoodsCellSoldOut(index: number, key: string): Promise<void> {
    await this.step(`Verify goods cell ${index} shows "${key}" as sold out at 30%`, async () => {
      await this.board.verifyGoodsCellSoldOut(index, key);
      await this.board.verifyGoodsCellDimmed(index);
    });
  }

  async verifyGoodsPriceAffordable(index: number, affordable: boolean): Promise<void> {
    await this.step(
      `Verify the price of goods cell ${index} is ${affordable ? '' : 'not '}affordable`,
      () => this.board.verifyGoodsPriceAffordable(index, affordable),
    );
  }

  async verifyCoinsOnBanner(coins: number): Promise<void> {
    await this.step(`Verify the banner shows ${coins} coins`, () =>
      this.board.verifyCoinsOnBanner(coins),
    );
  }

  async verifyWalletCoins(coins: number): Promise<void> {
    await this.step(`Verify the hero holds ${coins} coins`, () =>
      this.board.verifyWalletCoins(coins),
    );
  }

  async verifyWill(will: number): Promise<void> {
    await this.step(`Verify the hero has ${will} Will`, () => this.board.verifyWill(will));
  }

  async verifyTraderGoods(goods: ShopCellContent[]): Promise<void> {
    await this.step('Verify the goods the server holds', () => this.board.verifyTraderGoods(goods));
  }

  async verifyTraderBuyback(buyback: ShopBuybackContent[]): Promise<void> {
    await this.step('Verify the buyback the server holds', () =>
      this.board.verifyTraderBuyback(buyback),
    );
  }

  async verifyBagAmount(itemKey: string, amount: number): Promise<void> {
    await this.step(`Verify the bag holds ${amount} x "${itemKey}"`, () =>
      this.board.verifyBagAmount(itemKey, amount),
    );
  }

  async verifyBagStacks(itemKey: string, stacks: number[]): Promise<void> {
    await this.step(`Verify "${itemKey}" lies in the bag as stacks ${JSON.stringify(stacks)}`, () =>
      this.board.verifyBagStacks(itemKey, stacks),
    );
  }

  async buyByDraggingToABagCell(index: number): Promise<void> {
    await this.step(`Drag goods cell ${index} to a free bag cell`, () =>
      this.board.dragGoodsToBagCell(index),
    );
  }

  async buyHalfByDraggingToABagCell(index: number): Promise<void> {
    await this.step(`Shift-drag goods cell ${index} to a free bag cell`, () =>
      this.board.dragGoodsToBagCell(index, true),
    );
  }

  async buyByDroppingOnTheBag(index: number): Promise<void> {
    await this.step(`Drop goods cell ${index} on the bag panel`, () =>
      this.board.dragGoodsToBagPane(index),
    );
  }

  async selectGoods(index: number): Promise<void> {
    await this.step(`Click goods cell ${index} to select it`, () => this.board.selectGoods(index));
  }

  async selectBuyback(index: number): Promise<void> {
    await this.step(`Click buyback cell ${index} to select it`, () =>
      this.board.selectBuyback(index),
    );
  }

  async pressBuy(): Promise<void> {
    await this.step('Press the Buy button on the selection card', () => this.board.clickBuy());
  }

  async verifySelection(expected: {
    list: 'goods' | 'buyback';
    key: string;
    price: number;
    affordable: boolean;
    amount?: number;
  }): Promise<void> {
    await this.step(`Verify the selection card shows ${JSON.stringify(expected)}`, () =>
      this.board.verifySelectionShows(expected),
    );
  }

  async verifyBuyButtonReads(pattern: RegExp): Promise<void> {
    await this.step(`Verify the button reads ${pattern}`, () =>
      this.board.verifyBuyButtonReads(pattern),
    );
  }

  async verifyNoSelection(): Promise<void> {
    await this.step('Verify nothing is selected', () => this.board.verifyNoSelection());
  }

  async verifyGoodsCellSelected(index: number, selected: boolean): Promise<void> {
    await this.step(`Verify goods cell ${index} is ${selected ? '' : 'not '}highlighted`, () =>
      this.board.verifyGoodsCellSelected(index, selected),
    );
  }

  async buyByDoubleClick(index: number): Promise<void> {
    await this.step(`Double-click goods cell ${index}`, () => this.board.doubleClickGoods(index));
  }

  async buyByEnter(index: number): Promise<void> {
    await this.step(`Focus goods cell ${index} and press Enter`, () =>
      this.board.pressEnterOnGoods(index),
    );
  }

  async holdGoodsOverTheBag(index: number): Promise<void> {
    await this.step(`Hold goods cell ${index} over a bag cell without dropping it`, () =>
      this.board.holdGoodsOverBagCell(index),
    );
  }

  async verifyDragLabel(label: string): Promise<void> {
    await this.step(`Verify the drag label is "${label}"`, () => this.board.verifyDragLabel(label));
  }

  async verifyNoDragGhost(): Promise<void> {
    await this.step('Verify no drag is in progress', () => this.board.verifyNoDragGhost());
  }

  async pressEscape(): Promise<void> {
    await this.step('Press Escape', () => this.board.pressEscape());
  }

  async releasePointer(): Promise<void> {
    await this.step('Release the pointer', () => this.board.releasePointer());
  }

  async sellByDragging(itemKey: string, target: SellTarget): Promise<void> {
    await this.step(`Drag "${itemKey}" from the bag onto the ${target}`, () =>
      this.board.dragBagItemTo(itemKey, target),
    );
  }

  async sellHalfByDragging(itemKey: string, target: SellTarget): Promise<void> {
    await this.step(`Shift-drag "${itemKey}" from the bag onto the ${target}`, () =>
      this.board.dragBagItemTo(itemKey, target, true),
    );
  }

  async sellByRightClick(itemKey: string): Promise<void> {
    await this.step(`Right-click "${itemKey}" in the bag`, () =>
      this.board.rightClickBagItem(itemKey),
    );
  }

  async sellByDoubleClick(itemKey: string): Promise<void> {
    await this.step(`Double-click "${itemKey}" in the bag`, () =>
      this.board.doubleClickBagItem(itemKey),
    );
  }

  async buyBackByDragging(index: number): Promise<void> {
    await this.step(`Drag buyback cell ${index} to a free bag cell`, () =>
      this.board.dragBuybackToBagCell(index),
    );
  }

  async buyBackByRightClick(index: number): Promise<void> {
    await this.step(`Right-click buyback cell ${index}`, () => this.board.rightClickBuyback(index));
  }

  async verifyBuybackCell(index: number, expected: ShopCellShows): Promise<void> {
    await this.step(`Verify buyback cell ${index} shows ${JSON.stringify(expected)}`, () =>
      this.board.verifyBuybackCellShows(index, expected),
    );
  }

  async verifyBuybackRowHidden(): Promise<void> {
    await this.step('Verify the buyback row is hidden while it is empty', () =>
      this.board.verifyBuybackRowHidden(),
    );
  }

  async verifyBuybackRowShown(): Promise<void> {
    await this.step('Verify the buyback row is shown', () => this.board.verifyBuybackRowShown());
  }

  async pressNewGoods(): Promise<void> {
    await this.step('Press Refresh', () => this.board.clickRefresh());
  }

  async verifyRefreshButtonShowsCostOnHover(cost: number): Promise<void> {
    await this.step(
      `Verify the button says Refresh and a hover tooltip above it shows the Will icon and ${cost}`,
      () => this.board.verifyRefreshReadsAndHoverShowsTheCost(/^\s*(refresh|оновити)\s*$/i, cost),
    );
  }

  async verifyNewGoodsPrice(price: number): Promise<void> {
    await this.step(`Verify Refresh costs ${price} Will`, () =>
      this.board.verifyRefreshPrice(price),
    );
  }

  async verifyNewGoodsAffordable(affordable: boolean): Promise<void> {
    await this.step(`Verify Refresh is ${affordable ? '' : 'not '}affordable`, () =>
      this.board.verifyRefreshAffordable(affordable),
    );
  }

  async verifyNewGoodsAsksForConfirmation(asking: boolean): Promise<void> {
    await this.step(`Verify Refresh is ${asking ? '' : 'not '}waiting for the second click`, () =>
      this.board.verifyRefreshAsksForConfirmation(asking),
    );
  }

  async verifyServerRefreshPrice(price: number): Promise<void> {
    await this.step(`Verify the server projection prices Refresh at ${price}`, () =>
      this.board.verifyTraderRefreshPrice(price),
    );
  }

  async verifyGoodsSerial(serial: number): Promise<void> {
    await this.step(`Verify the goods are series ${serial}`, () =>
      this.board.verifyTraderSerial(serial),
    );
  }
}
