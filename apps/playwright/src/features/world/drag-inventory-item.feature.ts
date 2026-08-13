import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import type { EquipSlot } from '@config/equip-slot';

export class DragInventoryItemFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  async dragToGridSlot(itemKey: string, targetSlotKey: string): Promise<void> {
    await this.step(`Drag "${itemKey}" to grid slot "${targetSlotKey}"`, async () => {
      const itemId = await this.campingMap.inventory.getItemIdByKey(itemKey);
      await this.campingMap.inventory.dragTokenToGridSlot(itemId, targetSlotKey);
    });
  }

  async dragToEquipSlot(itemKey: string, slot: EquipSlot): Promise<void> {
    await this.step(`Drag "${itemKey}" to the "${slot}" equip slot`, async () => {
      const itemId = await this.campingMap.inventory.getItemIdByKey(itemKey);
      await this.campingMap.inventory.dragTokenToEquipSlot(itemId, slot);
    });
  }

  async dragEquippedToGridSlot(itemKey: string, targetSlotKey: string): Promise<void> {
    await this.step(`Drag equipped "${itemKey}" back to grid slot "${targetSlotKey}"`, async () => {
      const itemId = await this.campingMap.inventory.getItemIdByKey(itemKey);
      await this.campingMap.inventory.dragEquippedItemToGridSlot(itemId, targetSlotKey);
    });
  }
}
