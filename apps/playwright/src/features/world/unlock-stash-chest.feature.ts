import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { DragInventoryItemFeature } from '@features/world/drag-inventory-item.feature';
import { StashBoardFeature } from '@features/world/stash-board.feature';
import { MoveHeroFeature } from '@features/world/move-hero.feature';
import { SwitchHeroBoardTabFeature } from '@features/world/switch-hero-board-tab.feature';
import { UseEquippedToolFeature } from '@features/world/use-equipped-tool.feature';
import { VerifyInventoryFeature } from '@features/world/verify-inventory.feature';
import { EquipSlot } from '@config/equip-slot';
import { HexobjectKeys, tokenCoordinates } from '@config/test-data';

/** Unlocking the next Stash Chest by holding coins in a hand and using them on the chest. */
export class UnlockStashChestFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  async holdCoinsInHand(amount: number): Promise<void> {
    await this.step(`Hold ${amount} coins in a hand`, async () => {
      const stash = new StashBoardFeature();
      await stash.openByHand();
      await stash.close();
      await new MoveHeroFeature().moveAdjacentTo('stashChest');
      await this.page.evaluate(
        (n) => window.__HEXOFLAT_TEST__!.grantInventoryItem('coins', n),
        amount,
      );
      await new SwitchHeroBoardTabFeature().switchTo('inventory');
      await new DragInventoryItemFeature().dragToEquipSlot(HexobjectKeys.coins, EquipSlot.WEAPON);
      await new VerifyInventoryFeature().verifyItemEquipped(HexobjectKeys.coins, EquipSlot.WEAPON);
    });
  }

  async useCoinsOnTheChest(): Promise<void> {
    await this.step('Use the coins from the hand on the stash chest', async () => {
      await new UseEquippedToolFeature().use(HexobjectKeys.coins);
      await this.campingMap.hexBoard.hoverTile(tokenCoordinates('stashChest'));
      await this.campingMap.toolActionOverlay.verifyOfferedAction(/Unlock|Відімкнути/);
      await this.campingMap.toolActionOverlay.triggerAction();
    });
  }

  async verifyCoinsLeftInHand(amount: number): Promise<void> {
    await this.step(`Verify ${amount} coins are left`, () =>
      new VerifyInventoryFeature().verifyItemAmount(HexobjectKeys.coins, amount),
    );
  }
}
