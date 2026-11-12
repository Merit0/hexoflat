import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { MoveHeroFeature } from '@features/world/move-hero.feature';
import { ReloadCampingMapFeature } from '@features/world/reload-camping-map.feature';
import { UseHeroToolFeature } from '@features/world/use-hero-tool.feature';
import { Tool } from '@config/hero-tool';
import { tokenCoordinates } from '@config/test-data';

/** Opening and closing the camp trader's board: a real walk to the stall, then OPEN with the hand. */
export class OpenShopFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  private get board() {
    return this.campingMap.shopBoard;
  }

  async open(): Promise<void> {
    await this.step('Walk to the trader stall and open it with the hand tool', async () => {
      await new MoveHeroFeature().moveAdjacentTo('traderStall');
      await new UseHeroToolFeature(Tool.HAND).use();
      await this.campingMap.hexBoard.hoverTile(tokenCoordinates('traderStall'));
      await this.campingMap.toolActionOverlay.triggerAction();
      await this.board.verifyIsOpen();
    });
  }

  async openAfterReload(): Promise<void> {
    await this.step('Reload the camp, then open the stall again', async () => {
      await new ReloadCampingMapFeature().reload();
      await this.board.verifyIsClosed();
      await this.open();
    });
  }

  async verifyIsOpen(): Promise<void> {
    await this.step('Verify the trader board is open', async () => {
      await this.board.verifyIsOpen();
      await this.board.verifyOpenTraderIs('ilva');
    });
  }

  async verifyIsClosed(): Promise<void> {
    await this.step('Verify the trader board is closed', async () => {
      await this.board.verifyIsClosed();
      await this.board.verifyOpenTraderIs(null);
    });
  }

  async close(): Promise<void> {
    await this.step('Close the trader board with the cross', () => this.board.close());
  }

  async pressEscape(): Promise<void> {
    await this.step('Press Escape', () => this.board.pressEscape());
  }

  async walkAwayFromTheStall(): Promise<void> {
    await this.step('Walk the hero one step away from the stall', async () => {
      await new MoveHeroFeature().stepAwayFrom('traderStall');
    });
  }
}
