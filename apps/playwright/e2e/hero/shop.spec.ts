import { test } from '@fixtures';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { OpenShopFeature } from '@features/world/open-shop.feature';
import { ShopBoardFeature } from '@features/world/shop-board.feature';
import { VerifyActionAlertFeature } from '@features/world/verify-action-alert.feature';
import { VerifyToolActionFeature } from '@features/world/verify-tool-action.feature';
import {
  CoinPrices as Price,
  HexobjectKeys as K,
  REFRESH_BASE_WILL,
  SellValues,
} from '@config/test-data';

const NONE = null;
const emptyGoods = (...first: { key: string; amount: number; sold?: boolean }[]) => [
  ...first,
  ...Array.from({ length: 8 - first.length }, () => NONE),
];
const NOT_ENOUGH_COINS = /not enough coins|не вистачає монет/i;
const TOO_HEAVY = /cannot carry that much weight|не витримає такої ваги/i;
const NOT_INTERESTED = /not interested|не цікавить/i;
const NOT_ENOUGH_WILL = /not enough will|волі замало/i;
const ASKS_TO_CONFIRM = /click again|клацніть ще раз/i;
const BUYBACK_LOST = /buyback row will be lost|ряд викупу зникне/i;

async function openStall() {
  await new OpenCampingMapFeature().open();
  const stall = new OpenShopFeature();
  await stall.open();
  return { stall, shop: new ShopBoardFeature() };
}

test.describe('trader stall', { tag: ['@hero'] }, () => {
  test.describe('opening and closing', () => {
    test('Verify OPEN by hand on the stall opens the board with the trader and goods the server stocked', async () => {
      const { stall, shop } = await openStall();

      await stall.verifyIsOpen();
      await shop.verifyBanner();
      await shop.verifyServedGoods();
    });

    test('Verify every goods cell shows the whole-stack price from the approved price table', async () => {
      const { shop } = await openStall();

      await shop.givenGoods([
        { key: K.healthBottle, amount: 3 },
        { key: K.axe, amount: 1 },
        { key: K.sword, amount: 1 },
      ]);

      await shop.verifyGoodsCell(0, {
        key: K.healthBottle,
        amount: 3,
        price: 3 * Price.healthBottle,
      });
      await shop.verifyGoodsCell(1, { key: K.axe, amount: 1, price: Price.axe });
      await shop.verifyGoodsCell(2, { key: K.sword, amount: 1, price: Price.sword });
      await shop.verifyGoodsCell(3, NONE);
    });

    test('Verify the cross closes the board', async () => {
      const { stall } = await openStall();

      await stall.close();

      await stall.verifyIsClosed();
    });

    test('Verify Escape closes the board', async () => {
      const { stall } = await openStall();

      await stall.pressEscape();

      await stall.verifyIsClosed();
    });

    test('Verify walking away from the stall closes the board', async () => {
      const { stall } = await openStall();

      await stall.walkAwayFromTheStall();

      await stall.verifyIsClosed();
    });

    test('Verify closing the board stops the working hand tool', async () => {
      const { stall } = await openStall();

      await stall.close();

      await stall.verifyIsClosed();
      await new VerifyToolActionFeature().verifyToolHexHidden();
    });

    test('Verify Escape during a drag cancels only the drag: the board stays open and nothing is bought', async () => {
      const { stall, shop } = await openStall();
      await shop.givenGoods([{ key: K.axe, amount: 1 }]);
      await shop.givenBag([{ key: K.coins, amount: 100 }]);

      await shop.holdGoodsOverTheBag(0);
      await shop.pressEscape();
      await shop.releasePointer();

      await stall.verifyIsOpen();
      await shop.verifyNoDragGhost();
      await shop.verifyWalletCoins(100);
      await shop.verifyBagAmount(K.axe, 0);
      await shop.verifyTraderGoods(emptyGoods({ key: K.axe, amount: 1 }));
    });
  });

  test.describe('buying', () => {
    test('Verify dragging goods onto a bag cell buys them: the price is paid, the item lands in the bag, the cell stays as sold out on the server', async () => {
      const { shop } = await openStall();
      await shop.givenGoods([{ key: K.axe, amount: 1 }]);
      await shop.givenBag([{ key: K.coins, amount: 100 }]);

      await shop.buyByDraggingToABagCell(0);

      await shop.verifyBagAmount(K.axe, 1);
      await shop.verifyWalletCoins(100 - Price.axe);
      await shop.verifyTraderGoods(emptyGoods({ key: K.axe, amount: 1, sold: true }));
      await shop.verifyGoodsCellSoldOut(0, K.axe);
      await shop.verifyCoinsOnBanner(100 - Price.axe);
    });

    test('Verify a bought-out good stays on the shelf at 30% with a Sold out label and no price, and cannot be bought again', async () => {
      const { shop } = await openStall();
      await shop.givenGoods([{ key: K.axe, amount: 1 }]);
      await shop.givenBag([{ key: K.coins, amount: 200 }]);
      await shop.buyByDraggingToABagCell(0);
      await shop.verifyWalletCoins(200 - Price.axe);

      await shop.verifyGoodsCellSoldOut(0, K.axe);
      await shop.selectGoods(0);
      await shop.verifyNoSelection();
      await shop.buyByDoubleClick(0);

      await shop.verifyWalletCoins(200 - Price.axe);
      await shop.verifyBagAmount(K.axe, 1);
    });

    test('Verify half of a stack bought with Shift does not mark the good sold out', async () => {
      const { shop } = await openStall();
      await shop.givenGoods([{ key: K.healthBottle, amount: 5 }]);
      await shop.givenBag([{ key: K.coins, amount: 100 }]);

      await shop.buyHalfByDraggingToABagCell(0);

      await shop.verifyGoodsCell(0, {
        key: K.healthBottle,
        amount: 3,
        price: 3 * Price.healthBottle,
      });
    });

    test('Verify having exactly the price is enough: the shield is bought and the purse is empty', async () => {
      const { shop } = await openStall();
      await shop.givenGoods([{ key: K.shield, amount: 1 }]);
      await shop.givenBag([{ key: K.coins, amount: Price.shield }]);

      await shop.buyByDraggingToABagCell(0);

      await shop.verifyBagAmount(K.shield, 1);
      await shop.verifyWalletCoins(0);
    });

    test('Verify one coin short is refused: nothing is bought or paid, and the message names the price', async () => {
      const { shop } = await openStall();
      await shop.givenGoods([{ key: K.shield, amount: 1 }]);
      await shop.givenBag([{ key: K.coins, amount: Price.shield - 1 }]);
      await shop.verifyGoodsPriceAffordable(0, false);

      await shop.buyByDraggingToABagCell(0);

      await new VerifyActionAlertFeature().verifyIsShownMatching(NOT_ENOUGH_COINS);
      await new VerifyActionAlertFeature().verifyIsShownMatching(new RegExp(String(Price.shield)));
      await shop.verifyWalletCoins(Price.shield - 1);
      await shop.verifyBagAmount(K.shield, 0);
      await shop.verifyTraderGoods(emptyGoods({ key: K.shield, amount: 1 }));
    });

    test('Verify the drag label warns that the goods cannot be afforded before the pointer is released', async () => {
      const { shop } = await openStall();
      await shop.givenGoods([{ key: K.sword, amount: 1 }]);
      await shop.givenBag([{ key: K.coins, amount: 100 }]);

      await shop.holdGoodsOverTheBag(0);

      await shop.verifyDragLabel('cantAfford');
      await shop.pressEscape();
      await shop.releasePointer();
    });

    test('Verify dropping goods on the bag panel tops up the existing stack instead of starting a new one', async () => {
      const { shop } = await openStall();
      await shop.givenGoods([{ key: K.healthBottle, amount: 3 }]);
      await shop.givenBag([
        { key: K.healthBottle, amount: 4 },
        { key: K.coins, amount: 100 },
      ]);

      await shop.buyByDroppingOnTheBag(0);

      await shop.verifyBagStacks(K.healthBottle, [7]);
      await shop.verifyWalletCoins(100 - 3 * Price.healthBottle);
    });

    test('Verify a Shift-drag buys half of an odd stack and leaves the rest on the shelf', async () => {
      const { shop } = await openStall();
      await shop.givenGoods([{ key: K.healthBottle, amount: 5 }]);
      await shop.givenBag([{ key: K.coins, amount: 100 }]);

      await shop.buyHalfByDraggingToABagCell(0);

      await shop.verifyBagAmount(K.healthBottle, 2);
      await shop.verifyWalletCoins(100 - 2 * Price.healthBottle);
      await shop.verifyTraderGoods(emptyGoods({ key: K.healthBottle, amount: 3 }));
    });

    test('Verify a double click buys the whole stack', async () => {
      const { shop } = await openStall();
      await shop.givenGoods([{ key: K.healthBottle, amount: 3 }]);
      await shop.givenBag([{ key: K.coins, amount: 100 }]);

      await shop.buyByDoubleClick(0);

      await shop.verifyBagAmount(K.healthBottle, 3);
      await shop.verifyWalletCoins(100 - 3 * Price.healthBottle);
    });

    test('Verify Enter on a focused goods cell buys it from the keyboard', async () => {
      const { shop } = await openStall();
      await shop.givenGoods([{ key: K.axe, amount: 1 }]);
      await shop.givenBag([{ key: K.coins, amount: 100 }]);

      await shop.buyByEnter(0);

      await shop.verifyBagAmount(K.axe, 1);
      await shop.verifyWalletCoins(100 - Price.axe);
    });

    test('Verify goods too heavy for the bag are refused and nothing changes', async () => {
      const { shop } = await openStall();
      await shop.givenGoods([{ key: K.shield, amount: 1 }]);
      await shop.givenBag([
        { key: K.sword, amount: 1 },
        { key: K.shield, amount: 1 },
        { key: K.axe, amount: 1 },
        { key: K.pickaxe, amount: 1 },
        { key: K.returnScroll, amount: 50 },
        { key: K.coins, amount: 100 },
      ]);

      await shop.buyByDraggingToABagCell(0);

      await new VerifyActionAlertFeature().verifyIsShownMatching(TOO_HEAVY);
      await shop.verifyBagAmount(K.shield, 1);
      await shop.verifyWalletCoins(100);
      await shop.verifyTraderGoods(emptyGoods({ key: K.shield, amount: 1 }));
    });
  });

  test.describe('selecting a good and pressing Buy', () => {
    test('Verify clicking a good highlights it and shows its name, stack and stack price on a card, buying nothing yet', async () => {
      const { shop } = await openStall();
      await shop.givenGoods([
        { key: K.healthBottle, amount: 3 },
        { key: K.axe, amount: 1 },
      ]);
      await shop.givenBag([{ key: K.coins, amount: 100 }]);
      await shop.verifyNoSelection();

      await shop.selectGoods(0);

      await shop.verifySelection({
        list: 'goods',
        key: K.healthBottle,
        price: 3 * Price.healthBottle,
        affordable: true,
        amount: 3,
      });
      await shop.verifyGoodsCellSelected(0, true);
      await shop.verifyBuyButtonReads(/^\s*(buy|купити)\s*$/i);
      await shop.verifyWalletCoins(100);
      await shop.verifyBagAmount(K.healthBottle, 0);
    });

    test('Verify the Buy button buys the whole stack, pays the price and clears the card', async () => {
      const { shop } = await openStall();
      await shop.givenGoods([{ key: K.healthBottle, amount: 3 }]);
      await shop.givenBag([{ key: K.coins, amount: 100 }]);
      await shop.selectGoods(0);

      await shop.pressBuy();

      await shop.verifyBagAmount(K.healthBottle, 3);
      await shop.verifyWalletCoins(100 - 3 * Price.healthBottle);
      await shop.verifyTraderGoods(emptyGoods({ key: K.healthBottle, amount: 3, sold: true }));
      await shop.verifyNoSelection();
    });

    test('Verify selecting another good moves the card and the highlight to it', async () => {
      const { shop } = await openStall();
      await shop.givenGoods([
        { key: K.healthBottle, amount: 3 },
        { key: K.axe, amount: 1 },
      ]);
      await shop.givenBag([{ key: K.coins, amount: 100 }]);
      await shop.selectGoods(0);

      await shop.selectGoods(1);

      await shop.verifySelection({ list: 'goods', key: K.axe, price: Price.axe, affordable: true });
      await shop.verifyGoodsCellSelected(0, false);
      await shop.verifyGoodsCellSelected(1, true);
    });

    test('Verify a good that costs too much shows its price as unaffordable and Buy is refused with the price', async () => {
      const { shop } = await openStall();
      await shop.givenGoods([{ key: K.shield, amount: 1 }]);
      await shop.givenBag([{ key: K.coins, amount: Price.shield - 1 }]);
      await shop.selectGoods(0);
      await shop.verifySelection({
        list: 'goods',
        key: K.shield,
        price: Price.shield,
        affordable: false,
      });

      await shop.pressBuy();

      await new VerifyActionAlertFeature().verifyIsShownMatching(NOT_ENOUGH_COINS);
      await shop.verifyWalletCoins(Price.shield - 1);
      await shop.verifyBagAmount(K.shield, 0);
      await shop.verifySelection({
        list: 'goods',
        key: K.shield,
        price: Price.shield,
        affordable: false,
      });
    });

    test('Verify a buyback item is selected the same way and its button buys it back at the sale price', async () => {
      const { shop } = await openStall();
      await shop.givenTrader({
        buyback: [{ key: K.sword, amount: 1, unitPrice: SellValues.sword }],
      });
      await shop.givenBag([{ key: K.coins, amount: SellValues.sword }]);
      await shop.selectBuyback(0);

      await shop.verifySelection({
        list: 'buyback',
        key: K.sword,
        price: SellValues.sword,
        affordable: true,
      });
      await shop.verifyBuyButtonReads(/buy back|викупити/i);
      await shop.pressBuy();

      await shop.verifyBagAmount(K.sword, 1);
      await shop.verifyWalletCoins(0);
      await shop.verifyNoSelection();
    });

    test('Verify paid new goods clear the selection', async () => {
      const { shop } = await openStall();
      await shop.givenWill(REFRESH_BASE_WILL);
      await shop.selectGoods(0);
      await shop.pressNewGoods();
      await shop.pressNewGoods();

      await shop.verifyGoodsSerial(1);
      await shop.verifyNoSelection();
    });
  });

  test.describe('selling and buyback', () => {
    for (const target of ['trader', 'goods'] as const) {
      test(`Verify dropping a bag item on the ${target} sells it for 40% rounded down and puts it on the buyback row`, async () => {
        const { shop } = await openStall();
        await shop.givenBag([
          { key: K.axe, amount: 1 },
          { key: K.coins, amount: 100 },
        ]);
        await shop.verifyBuybackRowHidden();

        await shop.sellByDragging(K.axe, target);

        await shop.verifyBagAmount(K.axe, 0);
        await shop.verifyWalletCoins(100 + SellValues.axe);
        await shop.verifyTraderBuyback([
          { key: K.axe, amount: 1, unitPrice: SellValues.axe },
          NONE,
          NONE,
          NONE,
          NONE,
          NONE,
          NONE,
        ]);
        await shop.verifyBuybackRowShown();
        await shop.verifyBuybackCell(0, { key: K.axe, amount: 1, price: SellValues.axe });
      });
    }

    test('Verify a stack is paid per item rounded down, not as a rounded total', async () => {
      const { shop } = await openStall();
      await shop.givenBag([{ key: K.healthBottle, amount: 3 }]);

      await shop.sellByDragging(K.healthBottle, 'trader');

      await shop.verifyWalletCoins(3 * SellValues.healthBottle);
      await shop.verifyTraderBuyback([
        { key: K.healthBottle, amount: 3, unitPrice: SellValues.healthBottle },
        NONE,
        NONE,
        NONE,
        NONE,
        NONE,
        NONE,
      ]);
    });

    test('Verify selling does not animate the goods: every icon in the goods grid keeps its tilt', async () => {
      const { shop } = await openStall();
      await shop.givenGoods([
        { key: K.healthBottle, amount: 3 },
        { key: K.axe, amount: 1 },
        { key: K.sword, amount: 1 },
        { key: K.shield, amount: 1 },
      ]);
      await shop.givenBag([{ key: K.axe, amount: 1 }]);
      await shop.rememberGoodsTilt();

      await shop.sellByRightClick(K.axe);

      await shop.verifyWalletCoins(SellValues.axe);
      await shop.verifyGoodsTiltIsUnchanged();
    });

    test('Verify a Shift-drag sells half of an odd stack and keeps the rest', async () => {
      const { shop } = await openStall();
      await shop.givenBag([{ key: K.healthBottle, amount: 5 }]);

      await shop.sellHalfByDragging(K.healthBottle, 'trader');

      await shop.verifyBagAmount(K.healthBottle, 3);
      await shop.verifyWalletCoins(2 * SellValues.healthBottle);
    });

    test('Verify a right click sells the whole stack', async () => {
      const { shop } = await openStall();
      await shop.givenBag([{ key: K.axe, amount: 1 }]);

      await shop.sellByRightClick(K.axe);

      await shop.verifyBagAmount(K.axe, 0);
      await shop.verifyWalletCoins(SellValues.axe);
    });

    test('Verify buying an item back costs what it was sold for, not its shelf price, so the purse is whole again', async () => {
      const { shop } = await openStall();
      await shop.givenBag([
        { key: K.axe, amount: 1 },
        { key: K.coins, amount: 100 },
      ]);
      await shop.sellByDragging(K.axe, 'trader');
      await shop.verifyWalletCoins(100 + SellValues.axe);

      await shop.buyBackByDragging(0);

      await shop.verifyBagAmount(K.axe, 1);
      await shop.verifyWalletCoins(100);
      await shop.verifyTraderBuyback([NONE, NONE, NONE, NONE, NONE, NONE, NONE]);
      await shop.verifyBuybackRowHidden();
    });

    test('Verify a right click on the buyback row buys the item back', async () => {
      const { shop } = await openStall();
      await shop.givenTrader({
        buyback: [{ key: K.sword, amount: 1, unitPrice: SellValues.sword }],
      });
      await shop.givenBag([{ key: K.coins, amount: SellValues.sword }]);

      await shop.buyBackByRightClick(0);

      await shop.verifyBagAmount(K.sword, 1);
      await shop.verifyWalletCoins(0);
    });

    test('Verify coins cannot be sold: they stay in the bag and the buyback stays empty', async () => {
      const { shop } = await openStall();
      await shop.givenBag([{ key: K.coins, amount: 100 }]);

      await shop.sellByDragging(K.coins, 'trader');

      await new VerifyActionAlertFeature().verifyIsShownMatching(NOT_INTERESTED);
      await shop.verifyWalletCoins(100);
      await shop.verifyTraderBuyback([NONE, NONE, NONE, NONE, NONE, NONE, NONE]);
    });
  });

  test.describe('new goods', () => {
    test('Verify the button is named Refresh with no icon and a hover tooltip above it shows the Will icon and cost', async () => {
      const { shop } = await openStall();

      await shop.verifyRefreshButtonShowsCostOnHover(REFRESH_BASE_WILL);
    });

    test('Verify one Will short refuses at once, with no confirmation step and nothing spent', async () => {
      const { shop } = await openStall();
      await shop.givenWill(REFRESH_BASE_WILL - 1);
      await shop.verifyNewGoodsAffordable(false);

      await shop.pressNewGoods();

      await new VerifyActionAlertFeature().verifyIsShownMatching(NOT_ENOUGH_WILL);
      await new VerifyActionAlertFeature().verifyIsShownMatching(
        new RegExp(String(REFRESH_BASE_WILL)),
      );
      await shop.verifyNewGoodsAsksForConfirmation(false);
      await shop.verifyWill(REFRESH_BASE_WILL - 1);
      await shop.verifyGoodsSerial(0);
    });

    test('Verify the first click only asks to confirm and spends nothing', async () => {
      const { shop } = await openStall();
      await shop.givenWill(REFRESH_BASE_WILL);
      await shop.givenGoods([{ key: K.axe, amount: 1 }]);

      await shop.pressNewGoods();

      await shop.verifyNewGoodsAsksForConfirmation(true);
      await new VerifyActionAlertFeature().verifyIsShownMatching(ASKS_TO_CONFIRM);
      await shop.verifyWill(REFRESH_BASE_WILL);
      await shop.verifyGoodsSerial(0);
      await shop.verifyTraderGoods(emptyGoods({ key: K.axe, amount: 1 }));
    });

    test('Verify the second click pays the Will and brings the next series of goods', async () => {
      const { shop } = await openStall();
      await shop.givenWill(REFRESH_BASE_WILL);

      await shop.pressNewGoods();
      await shop.pressNewGoods();

      await shop.verifyWill(0);
      await shop.verifyGoodsSerial(1);
      await shop.verifyNewGoodsAsksForConfirmation(false);
      await shop.verifyServedGoods();
    });

    test('Verify Escape takes back the confirmation and keeps the board open', async () => {
      const { stall, shop } = await openStall();
      await shop.givenWill(REFRESH_BASE_WILL);
      await shop.pressNewGoods();
      await shop.verifyNewGoodsAsksForConfirmation(true);

      await shop.pressEscape();

      await shop.verifyNewGoodsAsksForConfirmation(false);
      await stall.verifyIsOpen();
      await shop.verifyWill(REFRESH_BASE_WILL);
      await shop.verifyGoodsSerial(0);
    });

    test('Verify the buyback row is announced as lost only when something is on it', async () => {
      const { shop } = await openStall();
      await shop.givenWill(REFRESH_BASE_WILL);
      await shop.givenTrader({ buyback: [{ key: K.axe, amount: 1, unitPrice: SellValues.axe }] });

      await shop.pressNewGoods();

      await new VerifyActionAlertFeature().verifyIsShownMatching(BUYBACK_LOST);
    });

    test('Verify an empty buyback row is not mentioned in the confirmation', async () => {
      const { shop } = await openStall();
      await shop.givenWill(REFRESH_BASE_WILL);

      await shop.pressNewGoods();

      await new VerifyActionAlertFeature().verifyIsShownMatching(ASKS_TO_CONFIRM);
      await new VerifyActionAlertFeature().verifyIsNotShownMatching(BUYBACK_LOST);
    });

    test('Verify a paid refresh clears the buyback row', async () => {
      const { shop } = await openStall();
      await shop.givenWill(REFRESH_BASE_WILL);
      await shop.givenTrader({ buyback: [{ key: K.axe, amount: 1, unitPrice: SellValues.axe }] });
      await shop.verifyBuybackRowShown();

      await shop.pressNewGoods();
      await shop.pressNewGoods();

      await shop.verifyTraderBuyback([NONE, NONE, NONE, NONE, NONE, NONE, NONE]);
      await shop.verifyBuybackRowHidden();
    });

    test('Verify every paid refresh doubles the price, and exactly that much Will is enough', async () => {
      const { shop } = await openStall();
      await shop.givenWill(50);
      await shop.pressNewGoods();
      await shop.pressNewGoods();
      await shop.verifyWill(50 - REFRESH_BASE_WILL);
      await shop.verifyNewGoodsPrice(2 * REFRESH_BASE_WILL);
      await shop.verifyNewGoodsAffordable(false);

      await shop.pressNewGoods();
      await new VerifyActionAlertFeature().verifyIsShownMatching(NOT_ENOUGH_WILL);
      await new VerifyActionAlertFeature().verifyIsShownMatching(
        new RegExp(String(2 * REFRESH_BASE_WILL)),
      );
      await shop.verifyGoodsSerial(1);
      await shop.givenWill(2 * REFRESH_BASE_WILL);
      await shop.verifyNewGoodsAffordable(true);
      await shop.pressNewGoods();
      await shop.pressNewGoods();

      await shop.verifyWill(0);
      await shop.verifyGoodsSerial(2);
      await shop.verifyNewGoodsPrice(4 * REFRESH_BASE_WILL);
    });

    test('Verify the price falls back to the base after a trip to the cave', async () => {
      const { shop } = await openStall();
      await shop.givenWill(50);
      await shop.pressNewGoods();
      await shop.pressNewGoods();
      await shop.verifyNewGoodsPrice(2 * REFRESH_BASE_WILL);

      await shop.givenTrader({ trips: 1 });

      await shop.verifyServerRefreshPrice(REFRESH_BASE_WILL);
      await shop.verifyNewGoodsPrice(REFRESH_BASE_WILL);
    });
  });

  test.describe('the server keeps the deals', () => {
    test('Verify a purchase survives a reload: the item, the purse and the sold-out cell', async () => {
      const { stall, shop } = await openStall();
      await shop.givenGoods([{ key: K.axe, amount: 1 }]);
      await shop.givenBag([{ key: K.coins, amount: 100 }]);
      await shop.buyByDraggingToABagCell(0);
      await shop.verifyWalletCoins(100 - Price.axe);

      await stall.openAfterReload();

      await shop.verifyBagAmount(K.axe, 1);
      await shop.verifyWalletCoins(100 - Price.axe);
      await shop.verifyGoodsCellSoldOut(0, K.axe);
      await shop.verifyCoinsOnBanner(100 - Price.axe);
    });

    test('Verify a sale survives a reload: the coins and the item waiting on the buyback row', async () => {
      const { stall, shop } = await openStall();
      await shop.givenBag([{ key: K.axe, amount: 1 }]);
      await shop.sellByDragging(K.axe, 'trader');
      await shop.verifyWalletCoins(SellValues.axe);

      await stall.openAfterReload();

      await shop.verifyWalletCoins(SellValues.axe);
      await shop.verifyBuybackCell(0, { key: K.axe, amount: 1, price: SellValues.axe });
    });

    test('Verify paid new goods survive a reload: the same series, the lower Will and the higher price', async () => {
      const { stall, shop } = await openStall();
      await shop.givenWill(50);
      await shop.pressNewGoods();
      await shop.pressNewGoods();
      await shop.verifyGoodsSerial(1);

      await stall.openAfterReload();

      await shop.verifyGoodsSerial(1);
      await shop.verifyWill(50 - REFRESH_BASE_WILL);
      await shop.verifyNewGoodsPrice(2 * REFRESH_BASE_WILL);
    });
  });
});
