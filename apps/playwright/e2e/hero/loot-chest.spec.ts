import { test } from '@fixtures';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { ReloadCampingMapFeature } from '@features/world/reload-camping-map.feature';
import { LootChestFeature } from '@features/world/loot-chest.feature';

test.describe('loot chest', { tag: ['@hero'] }, () => {
  test('Verify opening a chest puts the hero on it, scatters loot around it, and everything taken survives a reload', async () => {
    await new OpenCampingMapFeature().open();
    const chest = new LootChestFeature();
    await chest.placeChestNextToHero();

    await chest.openWithHand();
    await chest.verifyHeroStandsOnTheChest();
    await chest.verifyLootLiesAroundTheChest();
    await chest.takeEveryItem();
    await new ReloadCampingMapFeature().reload();

    await chest.verifyEverythingIsInTheBag();
    await chest.verifyChestIsEmpty();
    await chest.verifyHeroStandsOnTheChest();
  });

  test('Verify a reload while the hero stands on the chest keeps the same items on the same hexes', async () => {
    await new OpenCampingMapFeature().open();
    const chest = new LootChestFeature();
    await chest.placeChestNextToHero();
    await chest.openWithHand();

    await new ReloadCampingMapFeature().reload();

    await chest.verifyHeroStandsOnTheChest();
    await chest.verifyLootStaysWhereItLay();
    await chest.verifyChestIsEmpty();
  });

  test('Verify an opened chest cannot be opened again and says it is empty', async () => {
    await new OpenCampingMapFeature().open();
    const chest = new LootChestFeature();
    await chest.placeChestNextToHero();
    await chest.openWithHand();
    await chest.stepOffTheChest();

    await chest.tryOpenTheEmptyChest();

    await chest.verifyChestEmptyRefusal();
    await chest.verifyChestIsEmpty();
  });

  test('Verify a chest cannot be opened while the hero stands on another one', async () => {
    await new OpenCampingMapFeature().open();
    const chest = new LootChestFeature();
    await chest.placeChestNextToHero();
    await chest.openWithHand();

    await chest.placeSecondChestAndTryToOpenIt();

    await chest.verifyStandingRefusal();
  });

  test('Verify taking an item with a full bag leaves it on the map and says the bag is full', async () => {
    await new OpenCampingMapFeature().open();
    const chest = new LootChestFeature();
    await chest.fillTheBag();

    await chest.tryToTakeAnItemWithAFullBag();

    await chest.verifyBagIsFullRefusal();
    await chest.verifyTheItemStaysOnTheMap();
  });
});
