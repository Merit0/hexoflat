import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';

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
}
