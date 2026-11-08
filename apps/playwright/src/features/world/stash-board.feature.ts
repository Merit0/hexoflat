import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { MoveHeroFeature } from '@features/world/move-hero.feature';
import { OpenChestFeature } from '@features/world/open-chest.feature';
import type {
  StashCellContent,
  StashFilterId,
  StashTabState,
} from '@components/stash-board.component';

export type { StashCellContent };

export class StashBoardFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();
  private get board() {
    return this.campingMap.stashBoard;
  }

  async openByHand(): Promise<void> {
    await this.step('Open the stash chest with the hand tool', async () => {
      await new OpenChestFeature('stashChest').open();
      await this.board.verifyIsOpen();
    });
  }

  async verifyIsOpen(): Promise<void> {
    await this.step('Verify the stash board is open', () => this.board.verifyIsOpen());
  }

  async walkAwayFromTheChest(): Promise<void> {
    await this.step('Walk the hero one step away from the chest', async () => {
      await new MoveHeroFeature().moveOneStep();
    });
  }

  async pressEscape(): Promise<void> {
    await this.step('Press Escape', () => this.board.pressEscape());
  }

  async holdBagItemOverStashCell(itemKey: string, index: number): Promise<void> {
    await this.step(`Hold "${itemKey}" over stash cell ${index} without dropping it`, () =>
      this.board.holdBagItemOverStashCell(itemKey, index),
    );
  }

  async releasePointer(): Promise<void> {
    await this.step('Release the pointer', () => this.board.releasePointer());
  }

  async close(): Promise<void> {
    await this.step('Close the stash board', () => this.board.close());
  }

  async verifyIsClosed(): Promise<void> {
    await this.step('Verify the stash board is closed', () => this.board.verifyIsClosed());
  }

  async givenChests(count: number): Promise<void> {
    await this.step(`Arrange ${count} unlocked chest(s)`, () => this.board.givenChests(count));
  }

  async givenBag(cells: StashCellContent[]): Promise<void> {
    await this.step('Arrange the bag', () => this.board.givenBag(cells));
  }

  async givenEmptyStash(): Promise<void> {
    await this.step('Arrange an empty stash (without the starter gear)', () =>
      this.board.givenStash([]),
    );
  }

  async givenStash(cells: StashCellContent[]): Promise<void> {
    await this.step('Arrange the stash', () => this.board.givenStash(cells));
  }

  async verifyTabStates(states: StashTabState[]): Promise<void> {
    await this.step(`Verify the chest tabs are ${states.join(', ')}`, () =>
      this.board.verifyTabStates(states),
    );
  }

  async selectChest(chest: number): Promise<void> {
    await this.step(`Select chest ${chest}`, () => this.board.selectTab(chest));
  }

  async verifyFirstChestIsForSale(price: number): Promise<void> {
    await this.step(`Verify the chest is shown for ${price} coins with no buy button`, async () => {
      await this.board.verifyPrice(price);
      await this.board.verifyShopHasNoButton();
    });
  }

  async hoverThePrice(): Promise<void> {
    await this.step('Hover the price block', () => this.board.hoverPrice());
  }

  async verifyGridHasCells(count: number): Promise<void> {
    await this.step(`Verify the chest grid has ${count} cells`, () =>
      this.board.verifyGridHasCells(count),
    );
  }

  async dragBagItemToStashCell(itemKey: string, index: number): Promise<void> {
    await this.step(`Drag "${itemKey}" from the bag to stash cell ${index}`, () =>
      this.board.dragBagItemToStashCell(itemKey, index),
    );
  }

  async splitDragBagItemToStashCell(itemKey: string, index: number): Promise<void> {
    await this.step(`Shift-drag "${itemKey}" from the bag to stash cell ${index}`, () =>
      this.board.splitDragBagItemToStashCell(itemKey, index),
    );
  }

  async dragBagItemToStashPane(itemKey: string): Promise<void> {
    await this.step(`Drop "${itemKey}" on the stash panel`, () =>
      this.board.dragBagItemToStashPane(itemKey),
    );
  }

  async dragStashItemToFreeBagCell(index: number): Promise<void> {
    await this.step(`Drag stash cell ${index} to a free bag cell`, () =>
      this.board.dragStashItemToFreeBagCell(index),
    );
  }

  async dragStashItemToBagPane(index: number): Promise<void> {
    await this.step(`Drop stash cell ${index} on the bag panel`, () =>
      this.board.dragStashItemToBagPane(index),
    );
  }

  async quickMoveBagItem(itemKey: string): Promise<void> {
    await this.step(`Double-click "${itemKey}" in the bag`, () =>
      this.board.quickMoveBagItem(itemKey),
    );
  }

  async quickMoveStashItem(index: number): Promise<void> {
    await this.step(`Right-click stash cell ${index}`, () => this.board.quickMoveStashItem(index));
  }

  async storeResources(): Promise<void> {
    await this.step('Press Store resources', () => this.board.storeResources());
  }

  async sort(): Promise<void> {
    await this.step('Press Sort', () => this.board.sort());
  }

  async chooseFilter(filter: StashFilterId): Promise<void> {
    await this.step(`Choose the "${filter}" filter`, () => this.board.chooseFilter(filter));
  }

  async verifyCellDimmed(index: number, dimmed: boolean): Promise<void> {
    await this.step(`Verify stash cell ${index} is ${dimmed ? '' : 'not '}dimmed`, () =>
      this.board.verifyCellDimmed(index, dimmed),
    );
  }

  async verifyCellShows(index: number, itemKey: string, amount: number): Promise<void> {
    await this.step(`Verify stash cell ${index} shows ${amount} x "${itemKey}"`, () =>
      this.board.verifyCellShows(index, itemKey, amount),
    );
  }

  async verifyChests(count: number): Promise<void> {
    await this.step(`Verify ${count} chest(s) are unlocked`, () => this.board.verifyChests(count));
  }

  async verifyStashCell(index: number, expected: StashCellContent): Promise<void> {
    await this.step(`Verify stash cell ${index} holds ${JSON.stringify(expected)}`, () =>
      this.board.verifyStashCell(index, expected),
    );
  }

  async verifyStashFirstKeys(keys: (string | null)[]): Promise<void> {
    await this.step(`Verify the first stash cells hold ${JSON.stringify(keys)}`, () =>
      this.board.verifyStashFirstKeys(keys),
    );
  }

  async verifyBagAmount(itemKey: string, amount: number): Promise<void> {
    await this.step(`Verify the bag holds ${amount} x "${itemKey}"`, () =>
      this.board.verifyBagAmount(itemKey, amount),
    );
  }
}
