import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import type { EquipSlot } from '@config/equip-slot';

export class VerifyInventoryFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  async verifyPanelIsVisible(): Promise<void> {
    await this.step('Verify the hero board panel is visible', () =>
      this.campingMap.inventory.verifyIsVisible(),
    );
  }

  async verifyContainsItem(itemKey: string): Promise<void> {
    await this.step(`Verify "${itemKey}" reached the inventory`, () =>
      this.campingMap.inventory.verifyContainsItem(itemKey),
    );
  }

  async verifyItemAmount(itemKey: string, amount: number): Promise<void> {
    await this.step(`Verify the inventory holds ${amount} x "${itemKey}"`, () =>
      this.campingMap.inventory.verifyItemAmount(itemKey, amount),
    );
  }

  async verifyDoesNotContainItem(itemKey: string): Promise<void> {
    await this.step(`Verify "${itemKey}" is not in the inventory yet`, () =>
      this.campingMap.inventory.verifyDoesNotContainItem(itemKey),
    );
  }

  async verifyItemInGridSlot(itemKey: string, slotKey: string): Promise<void> {
    await this.step(`Verify "${itemKey}" sits in grid slot "${slotKey}"`, async () => {
      const itemId = await this.campingMap.inventory.getItemIdByKey(itemKey);
      await this.campingMap.inventory.verifyItemInGridSlot(itemId, slotKey);
    });
  }

  async verifyItemEquipped(itemKey: string, slot: EquipSlot): Promise<void> {
    await this.step(`Verify "${itemKey}" is equipped in the "${slot}" slot`, async () => {
      const itemId = await this.campingMap.inventory.getItemIdByKey(itemKey);
      await this.campingMap.inventory.verifyItemEquipped(itemId, slot);
    });
  }

  async verifyWillTokenPresent(): Promise<void> {
    await this.step('Verify the Will token sits in its reserved inventory cell', async () => {
      await this.campingMap.inventory.verifyWillTokenInItsCell();
      await this.campingMap.inventory.verifyWillTooltipOnHover();
    });
  }

  async verifyWillCellStaysFree(): Promise<void> {
    await this.step('Verify no item occupies the Will cell', () =>
      this.campingMap.inventory.verifyWillCellHoldsNoItem(),
    );
  }

  async verifyBagItemTooltip(itemKey: string, title: RegExp): Promise<void> {
    await this.step(`Hovering "${itemKey}" in the bag explains it, leaving hides it`, async () => {
      const itemId = await this.campingMap.inventory.getItemIdByKey(itemKey);
      await this.campingMap.inventory.hoverGridItem(itemId);
      await this.campingMap.inventory.verifyTooltipTitle(title);
      await this.campingMap.inventory.moveMouseAway();
      await this.campingMap.inventory.verifyTooltipHidden();
    });
  }

  async verifyEquippedItemTooltip(itemKey: string, title: RegExp): Promise<void> {
    await this.step(`Hovering equipped "${itemKey}" explains it as equipped`, async () => {
      const itemId = await this.campingMap.inventory.getItemIdByKey(itemKey);
      await this.campingMap.inventory.hoverEquippedItem(itemId);
      await this.campingMap.inventory.verifyTooltipTitle(title);
      await this.campingMap.inventory.verifyTooltipMarkedEquipped();
    });
  }
}
