import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import type { EquipSlot } from '@config/equip-slot';

export class VerifyInventoryFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  async verifyContainsItem(itemKey: string): Promise<void> {
    await this.step(`Verify "${itemKey}" reached the inventory`, () =>
      this.campingMap.inventory.verifyContainsItem(itemKey),
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
}
