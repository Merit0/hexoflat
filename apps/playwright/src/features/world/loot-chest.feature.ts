import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { UseHeroToolFeature } from '@features/world/use-hero-tool.feature';
import { Tool } from '@config/hero-tool';
import { HexobjectKeys } from '@config/test-data';
import type { TestGroundItem, TestHexCoordinates } from '@framework/test-api';

const BAG_FULL_TEXT = /Сумка повна|Your bag is full/;
const CHEST_EMPTY_TEXT = /Скриня порожня|The chest is empty/;
const STANDING_TEXT = /Спершу зійди|Step off this spot first/;

function byPlace(a: TestGroundItem, b: TestGroundItem): number {
  return (
    a.coordinates.columnIndex - b.coordinates.columnIndex ||
    a.coordinates.rowIndex - b.coordinates.rowIndex
  );
}

/**
 * A chest opened with the hand, the loot it scatters and everything the player does with it. A chest is
 * put beside the hero with the placement hook (the cave one is random to reach), then opened and
 * emptied through the real OPEN and TAKE actions.
 */
export class LootChestFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();
  private chest: TestHexCoordinates | null = null;
  private entry: TestHexCoordinates | null = null;
  private scattered: TestGroundItem[] = [];

  async placeChestNextToHero(): Promise<void> {
    await this.step('Put a full chest on a free hex next to the hero', async () => {
      this.entry = await this.campingMap.hexBoard.requireHeroCoordinates();
      this.chest = await this.campingMap.hexBoard.placeItemNextToHero(HexobjectKeys.chest);
      await this.campingMap.lootBoard.verifyChestState(this.chest, 'full');
    });
  }

  async openWithHand(): Promise<void> {
    await this.step('Open the chest with the hand', async () => {
      await new UseHeroToolFeature(Tool.HAND).use();
      await this.campingMap.hexBoard.hoverTile(this.requireChest());
      await this.campingMap.toolActionOverlay.triggerAction();
      await this.campingMap.lootBoard.verifyChestState(this.requireChest(), 'empty');
      await this.campingMap.lootBoard.waitUntilLootHasLanded();
      this.scattered = (await this.campingMap.lootBoard.getGroundItems()).sort(byPlace);
    });
  }

  async verifyHeroStandsOnTheChest(): Promise<void> {
    await this.step('Verify the hero stands on the chest hex', () =>
      this.campingMap.hexBoard.verifyHeroSettledAt(this.requireChest()),
    );
  }

  async verifyLootLiesAroundTheChest(): Promise<void> {
    await this.step(
      'Verify loot lies on free hexes around the chest, never on the entry hex',
      async () => {
        const items = await this.campingMap.lootBoard.waitForGroundItems(1);
        for (const item of items) {
          const distance = await this.campingMap.hexBoard.distanceBetween(
            item.coordinates,
            this.requireChest(),
          );
          if (distance !== 1)
            throw new Error(`"${item.itemKey}" lies ${distance} hexes from the chest.`);
          const onEntry =
            item.coordinates.columnIndex === this.requireEntry().columnIndex &&
            item.coordinates.rowIndex === this.requireEntry().rowIndex;
          if (onEntry) throw new Error(`"${item.itemKey}" lies on the entry hex.`);
        }
      },
    );
  }

  async takeEveryItem(): Promise<void> {
    await this.step('Take every item lying around the chest', async () => {
      for (const item of this.scattered) {
        await new UseHeroToolFeature(Tool.HAND).use();
        await this.campingMap.hexBoard.hoverTile(item.coordinates);
        await this.campingMap.toolActionOverlay.triggerAction();
        await this.campingMap.hexBoard.verifyTileIsCleared(item.coordinates);
      }
      await this.campingMap.lootBoard.verifyNoGroundItems();
    });
  }

  async verifyEverythingIsInTheBag(): Promise<void> {
    await this.step('Verify every taken item, with its quantity, is in the bag', async () => {
      const totals = new Map<string, number>();
      for (const item of this.scattered) {
        totals.set(item.itemKey, (totals.get(item.itemKey) ?? 0) + item.quantity);
      }
      for (const [key, amount] of totals) {
        await this.campingMap.inventory.verifyItemAmount(key, amount);
      }
    });
  }

  async verifyChestIsEmpty(): Promise<void> {
    await this.step('Verify the chest is opened and empty', () =>
      this.campingMap.lootBoard.verifyChestState(this.requireChest(), 'empty'),
    );
  }

  async verifyLootStaysWhereItLay(): Promise<void> {
    await this.step(
      'Verify the same loot lies on the same hexes with the same quantities',
      async () => {
        await this.campingMap.lootBoard.waitForGroundItems(this.scattered.length);
        const now = (await this.campingMap.lootBoard.getGroundItems()).sort(byPlace);
        if (JSON.stringify(now) !== JSON.stringify(this.scattered)) {
          throw new Error(
            `Loot changed: ${JSON.stringify(this.scattered)} -> ${JSON.stringify(now)}`,
          );
        }
      },
    );
  }

  async stepOffTheChest(): Promise<void> {
    await this.step('Put the hand down and step off the chest onto a free hex', async () => {
      await this.campingMap.lootBoard.putTheHandDown();
      await this.campingMap.hexBoard.stepAwayFrom(this.requireChest());
    });
  }

  async tryOpenTheEmptyChest(): Promise<void> {
    await this.step('Try to open the empty chest', () =>
      this.campingMap.lootBoard.tryOpenChest(this.requireChest()),
    );
  }

  async verifyChestEmptyRefusal(): Promise<void> {
    await this.step('Verify the hero is told the chest is empty', () =>
      this.campingMap.actionAlertBanner.verifyIsVisibleMatching(CHEST_EMPTY_TEXT),
    );
  }

  async placeSecondChestAndTryToOpenIt(): Promise<void> {
    await this.step(
      'Put a second chest next to the hero and try to open it from the first',
      async () => {
        const second = await this.campingMap.hexBoard.placeItemNextToHero(HexobjectKeys.chest);
        await this.campingMap.lootBoard.tryOpenChest(second);
        await this.campingMap.lootBoard.verifyChestState(second, 'full');
      },
    );
  }

  async verifyStandingRefusal(): Promise<void> {
    await this.step('Verify the hero is told to step off first', () =>
      this.campingMap.actionAlertBanner.verifyIsVisibleMatching(STANDING_TEXT),
    );
  }

  async fillTheBag(): Promise<void> {
    await this.step('Fill every cell of the bag', () =>
      this.campingMap.lootBoard.fillTheBagWith(HexobjectKeys.sword),
    );
  }

  async tryToTakeAnItemWithAFullBag(): Promise<void> {
    await this.step('Put an axe next to the hero and try to take it', async () => {
      const spot = await this.campingMap.hexBoard.placeItemNextToHero(HexobjectKeys.axe);
      this.scattered = [{ coordinates: spot, itemKey: HexobjectKeys.axe, quantity: 1 }];
      await new UseHeroToolFeature(Tool.HAND).use();
      await this.campingMap.hexBoard.hoverTile(spot);
      await this.campingMap.toolActionOverlay.triggerAction();
    });
  }

  async verifyBagIsFullRefusal(): Promise<void> {
    await this.step('Verify the hero is told the bag is full', () =>
      this.campingMap.actionAlertBanner.verifyIsVisibleMatching(BAG_FULL_TEXT),
    );
  }

  async verifyTheItemStaysOnTheMap(): Promise<void> {
    await this.step('Verify the item stayed on its hex', () =>
      this.campingMap.hexBoard.verifyTileHoldsHexobject(
        this.scattered[0].coordinates,
        this.scattered[0].itemKey,
      ),
    );
  }

  private requireChest(): TestHexCoordinates {
    if (!this.chest) throw new Error('No chest has been placed yet.');
    return this.chest;
  }

  private requireEntry(): TestHexCoordinates {
    if (!this.entry) throw new Error('The hero entry hex is not known yet.');
    return this.entry;
  }
}
