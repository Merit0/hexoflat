import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';

export class UseEquippedToolFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  async use(itemKey: string): Promise<void> {
    await this.step(`Press USE on the equipped "${itemKey}"`, async () => {
      const itemId = await this.campingMap.inventory.getItemIdByKey(itemKey);
      await this.campingMap.inventory.useEquippedItem(itemId);
    });
  }
}
