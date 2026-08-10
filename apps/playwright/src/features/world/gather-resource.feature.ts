import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { tokenCoordinates, type MapToken } from '@config/test-data';

/**
 * Picking an item up off the map with the hero's bare HAND.
 *
 * There is no in-game way yet to reach a TREE/ROCK (the RESOURCE group):
 * those only exist on the 'silesia' map, and cutting/mining them needs an
 * AXE/PICKAXE the hero doesn't start with (see the engine's
 * resources.content.ts `requiredTool`). Taking the starter AXE placed in the
 * safe camping zone exercises the same START_HEX_ACTION → TAKE pipeline
 * without also depending on cross-map travel or fog-of-war reveal.
 */
export class GatherResourceFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  constructor(private readonly token: MapToken) {
    super();
  }

  async armHandTool(): Promise<void> {
    await this.step('Arm the hero’s HAND tool', () => this.campingMap.hexBoard.armHandTool());
  }

  /** Hovers the target tile with the armed tool and triggers the offered action. */
  async take(): Promise<void> {
    await this.step(`Take whatever sits on "${this.token}"`, async () => {
      await this.campingMap.hexBoard.hoverTile(tokenCoordinates(this.token));
      await this.campingMap.toolActionOverlay.triggerAction();
    });
  }

  async verifyItemNotInInventory(itemKey: string): Promise<void> {
    await this.step(`Verify "${itemKey}" is not in the inventory yet`, () =>
      this.campingMap.inventory.verifyDoesNotContainItem(itemKey),
    );
  }

  async verifyItemInInventory(itemKey: string): Promise<void> {
    await this.step(`Verify "${itemKey}" reached the inventory`, () =>
      this.campingMap.inventory.verifyContainsItem(itemKey),
    );
  }

  /** Confirms the object left the *map*, not just that the inventory grew. */
  async verifyTileCleared(): Promise<void> {
    await this.step(`Verify "${this.token}" is now empty`, () =>
      this.campingMap.hexBoard.verifyTileIsCleared(tokenCoordinates(this.token)),
    );
  }

  async verifyTakeActionNoLongerOffered(): Promise<void> {
    await this.step('Verify the tool overlay stops offering the action', () =>
      this.campingMap.toolActionOverlay.verifyActionIsNoLongerOffered(),
    );
  }
}
