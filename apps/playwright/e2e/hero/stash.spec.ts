import { test } from '@fixtures';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { ReloadCampingMapFeature } from '@features/world/reload-camping-map.feature';
import { StashBoardFeature, type StashCellContent } from '@features/world/stash-board.feature';
import { UnlockStashChestFeature } from '@features/world/unlock-stash-chest.feature';
import { VerifyActionAlertFeature } from '@features/world/verify-action-alert.feature';
import { VerifyMapTileFeature } from '@features/world/verify-map-tile.feature';
import { VerifyToolActionFeature } from '@features/world/verify-tool-action.feature';
import { HexobjectKeys as K } from '@config/test-data';

const NONE = null;

test.describe('stash', { tag: ['@hero'] }, () => {
  test.describe('the camp map', () => {
    test('Verify the camp map no longer holds the starter gear or coins', async () => {
      await new OpenCampingMapFeature().open();

      await new VerifyMapTileFeature('formerSwordSpot').verifyCleared();
      await new VerifyMapTileFeature('formerAxeSpot').verifyCleared();
      await new VerifyMapTileFeature('formerShieldSpot').verifyCleared();
      await new VerifyMapTileFeature('formerPickaxeSpot').verifyCleared();
      await new VerifyMapTileFeature('formerCoinsSpot').verifyCleared();
    });
  });

  test.describe('opening and closing', () => {
    test('Verify OPEN by hand on the stash chest opens the board with five locked tabs and a priced first chest', async () => {
      await new OpenCampingMapFeature().open();
      const stash = new StashBoardFeature();

      await stash.openByHand();

      await stash.verifyTabStates(['locked', 'locked', 'locked', 'locked', 'locked']);
      await stash.verifyFirstChestIsForSale(100);
    });

    test('Verify hovering the price explains how to pay, through the hero message', async () => {
      await new OpenCampingMapFeature().open();
      const stash = new StashBoardFeature();
      await stash.openByHand();

      await stash.hoverThePrice();

      await new VerifyActionAlertFeature().verifyIsShownMatching(/coins|монет/i);
    });

    test('Verify walking away from the chest closes the board', async () => {
      await new OpenCampingMapFeature().open();
      const stash = new StashBoardFeature();
      await stash.openByHand();

      await stash.walkAwayFromTheChest();

      await stash.verifyIsClosed();
    });

    test('Verify Escape closes the board', async () => {
      await new OpenCampingMapFeature().open();
      const stash = new StashBoardFeature();
      await stash.openByHand();

      await stash.pressEscape();

      await stash.verifyIsClosed();
    });

    test('Verify Escape during a drag cancels only the drag: the board stays open and the item stays put', async () => {
      await new OpenCampingMapFeature().open();
      const stash = new StashBoardFeature();
      await stash.openByHand();
      await stash.givenChests(1);
      await stash.givenEmptyStash();
      await stash.givenBag([{ key: K.sword, amount: 1 }]);

      await stash.holdBagItemOverStashCell(K.sword, 3);
      await stash.pressEscape();
      await stash.releasePointer();

      await stash.verifyIsOpen();
      await stash.verifyStashCell(3, NONE);
      await stash.verifyBagAmount(K.sword, 1);
    });

    test('Verify closing the board stops the working hand tool', async () => {
      await new OpenCampingMapFeature().open();
      const stash = new StashBoardFeature();
      await stash.openByHand();

      await stash.close();

      await stash.verifyIsClosed();
      await new VerifyToolActionFeature().verifyToolHexHidden();
    });
  });

  test.describe('moving items', () => {
    test('Verify dragging a bag item onto a stash cell moves it there', async () => {
      await new OpenCampingMapFeature().open();
      const stash = new StashBoardFeature();
      await stash.openByHand();
      await stash.givenChests(1);
      await stash.givenBag([{ key: K.sword, amount: 1 }]);

      await stash.dragBagItemToStashCell(K.sword, 5);

      await stash.verifyStashCell(5, { key: K.sword, amount: 1 });
      await stash.verifyBagAmount(K.sword, 0);
    });

    test('Verify dragging a stack onto the same kind merges up to the stack limit and leaves the rest', async () => {
      await new OpenCampingMapFeature().open();
      const stash = new StashBoardFeature();
      await stash.openByHand();
      await stash.givenChests(1);
      await stash.givenBag([{ key: K.healthBottle, amount: 8 }]);
      await stash.givenStash([{ key: K.healthBottle, amount: 5 }]);

      await stash.dragBagItemToStashCell(K.healthBottle, 0);

      await stash.verifyStashCell(0, { key: K.healthBottle, amount: 10 });
      await stash.verifyBagAmount(K.healthBottle, 3);
    });

    test('Verify a Shift-drag moves half of an odd stack', async () => {
      await new OpenCampingMapFeature().open();
      const stash = new StashBoardFeature();
      await stash.openByHand();
      await stash.givenChests(1);
      await stash.givenEmptyStash();
      await stash.givenBag([{ key: K.healthBottle, amount: 7 }]);

      await stash.splitDragBagItemToStashCell(K.healthBottle, 2);

      await stash.verifyStashCell(2, { key: K.healthBottle, amount: 3 });
      await stash.verifyBagAmount(K.healthBottle, 4);
    });

    test('Verify taking a heavy item from the stash into an almost full bag is refused and nothing moves', async () => {
      await new OpenCampingMapFeature().open();
      const stash = new StashBoardFeature();
      await stash.openByHand();
      await stash.givenChests(1);
      await stash.givenBag([
        { key: K.sword, amount: 1 },
        { key: K.shield, amount: 1 },
        { key: K.axe, amount: 1 },
        { key: K.pickaxe, amount: 1 },
        { key: K.returnScroll, amount: 50 },
      ]);
      await stash.givenStash([{ key: K.shield, amount: 1 }]);

      await stash.dragStashItemToFreeBagCell(0);

      await new VerifyActionAlertFeature().verifyIsShownMatching(/heavy|ваги/i);
      await stash.verifyStashCell(0, { key: K.shield, amount: 1 });
      await stash.verifyBagAmount(K.shield, 1);
    });

    test('Verify dropping on the stash panel fills the first free cell of the chest on view', async () => {
      await new OpenCampingMapFeature().open();
      const stash = new StashBoardFeature();
      await stash.openByHand();
      await stash.givenChests(2);
      await stash.givenEmptyStash();
      await stash.givenBag([{ key: K.sword, amount: 1 }]);
      await stash.selectChest(2);

      await stash.dragBagItemToStashPane(K.sword);

      await stash.verifyStashCell(42, { key: K.sword, amount: 1 });
      await stash.verifyStashCell(0, NONE);
    });

    test('Verify a double click sends a bag item to the stash', async () => {
      await new OpenCampingMapFeature().open();
      const stash = new StashBoardFeature();
      await stash.openByHand();
      await stash.givenChests(1);
      await stash.givenEmptyStash();
      await stash.givenBag([{ key: K.axe, amount: 1 }]);

      await stash.quickMoveBagItem(K.axe);

      await stash.verifyStashCell(0, { key: K.axe, amount: 1 });
      await stash.verifyBagAmount(K.axe, 0);
    });

    test('Verify a right click brings a stash item back to the bag', async () => {
      await new OpenCampingMapFeature().open();
      const stash = new StashBoardFeature();
      await stash.openByHand();
      await stash.givenChests(1);
      await stash.givenBag([]);
      await stash.givenStash([{ key: K.axe, amount: 1 }]);

      await stash.quickMoveStashItem(0);

      await stash.verifyStashCell(0, NONE);
      await stash.verifyBagAmount(K.axe, 1);
    });
  });

  test.describe('stash actions', () => {
    test('Verify Store resources moves resources and consumables and keeps gear in the bag', async () => {
      await new OpenCampingMapFeature().open();
      const stash = new StashBoardFeature();
      await stash.openByHand();
      await stash.givenChests(1);
      await stash.givenEmptyStash();
      await stash.givenBag([
        { key: K.coins, amount: 12 },
        { key: K.healthBottle, amount: 2 },
        { key: K.sword, amount: 1 },
      ]);

      await stash.storeResources();

      await stash.verifyBagAmount(K.coins, 0);
      await stash.verifyBagAmount(K.healthBottle, 0);
      await stash.verifyBagAmount(K.sword, 1);
      await stash.verifyStashFirstKeys([K.coins, K.healthBottle, NONE]);
    });

    test('Verify Sort puts gear first and resources last', async () => {
      await new OpenCampingMapFeature().open();
      const stash = new StashBoardFeature();
      await stash.openByHand();
      await stash.givenChests(1);
      const cells: StashCellContent[] = Array.from({ length: 13 }, () => NONE);
      cells[0] = { key: K.coins, amount: 4 };
      cells[5] = { key: K.sword, amount: 1 };
      cells[12] = { key: K.axe, amount: 1 };
      await stash.givenStash(cells);

      await stash.sort();

      await stash.verifyStashFirstKeys([K.sword, K.axe, K.coins, NONE]);
    });

    test('Verify Sort merges stacks of the same kind', async () => {
      await new OpenCampingMapFeature().open();
      const stash = new StashBoardFeature();
      await stash.openByHand();
      await stash.givenChests(1);
      const cells: StashCellContent[] = Array.from({ length: 10 }, () => NONE);
      cells[0] = { key: K.coins, amount: 4 };
      cells[9] = { key: K.coins, amount: 6 };
      await stash.givenStash(cells);

      await stash.sort();

      await stash.verifyStashCell(0, { key: K.coins, amount: 10 });
      await stash.verifyStashCell(1, NONE);
    });

    test('Verify Store resources asks to unlock a chest first when none is unlocked', async () => {
      await new OpenCampingMapFeature().open();
      const stash = new StashBoardFeature();
      await stash.openByHand();
      await stash.givenBag([{ key: K.coins, amount: 5 }]);

      await stash.storeResources();

      await new VerifyActionAlertFeature().verifyIsShownMatching(/unlock a chest|відімкни скриню/i);
      await stash.verifyBagAmount(K.coins, 5);
    });

    test('Verify Sort asks to unlock a chest first when none is unlocked', async () => {
      await new OpenCampingMapFeature().open();
      const stash = new StashBoardFeature();
      await stash.openByHand();

      await stash.sort();

      await new VerifyActionAlertFeature().verifyIsShownMatching(/unlock a chest|відімкни скриню/i);
    });

    test('Verify a filter dims what does not match and keeps every item where it was', async () => {
      await new OpenCampingMapFeature().open();
      const stash = new StashBoardFeature();
      await stash.openByHand();
      await stash.givenChests(1);
      await stash.givenStash([
        { key: K.sword, amount: 1 },
        { key: K.healthBottle, amount: 3 },
      ]);

      await stash.chooseFilter('gear');

      await stash.verifyCellDimmed(0, false);
      await stash.verifyCellDimmed(1, true);
      await stash.verifyCellDimmed(7, false);
      await stash.verifyCellShows(1, K.healthBottle, 3);
    });

    test('Verify the stash content survives a reload', async () => {
      await new OpenCampingMapFeature().open();
      const stash = new StashBoardFeature();
      await stash.openByHand();
      await stash.givenChests(1);
      await stash.givenBag([{ key: K.sword, amount: 1 }]);
      await stash.dragBagItemToStashCell(K.sword, 4);
      await stash.verifyStashCell(4, { key: K.sword, amount: 1 });

      await new ReloadCampingMapFeature().reload();

      await stash.verifyChests(1);
      await stash.verifyStashCell(4, { key: K.sword, amount: 1 });
    });
  });

  test.describe('unlocking chests with coins from the hand', () => {
    test('Verify 140 coins in a hand pay exactly 100 for the first chest and 40 stay in the hand', async () => {
      await new OpenCampingMapFeature().open();
      const unlock = new UnlockStashChestFeature();
      await unlock.holdCoinsInHand(140);

      await unlock.useCoinsOnTheChest();

      await new StashBoardFeature().verifyChests(1);
      await unlock.verifyCoinsLeftInHand(40);
      await new VerifyActionAlertFeature().verifyIsShownMatching(/unlock|відімкнув/i);
    });

    test('Verify 90 coins cannot pay for the first chest: a warning shows the price and nothing changes', async () => {
      await new OpenCampingMapFeature().open();
      const unlock = new UnlockStashChestFeature();
      await unlock.holdCoinsInHand(90);

      await unlock.useCoinsOnTheChest();

      await new VerifyActionAlertFeature().verifyIsShownMatching(/100/);
      await new StashBoardFeature().verifyChests(0);
      await unlock.verifyCoinsLeftInHand(90);
    });

    test('Verify the second chest costs 1000 coins', async () => {
      await new OpenCampingMapFeature().open();
      const stash = new StashBoardFeature();
      await stash.openByHand();
      await stash.givenChests(1);
      await stash.close();
      const unlock = new UnlockStashChestFeature();
      await unlock.holdCoinsInHand(1200);

      await unlock.useCoinsOnTheChest();

      await stash.verifyChests(2);
      await unlock.verifyCoinsLeftInHand(200);
    });
  });
});
