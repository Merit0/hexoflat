import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';

export class VerifyActionAlertFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  async verifyIsShownWithMessage(message: string): Promise<void> {
    await this.step(`Verify the action alert shows "${message}"`, () =>
      this.campingMap.actionAlertBanner.verifyIsVisibleWithText(message),
    );
  }

  async verifyAutoHides(): Promise<void> {
    await this.step('Verify the action alert auto-hides', () =>
      this.campingMap.actionAlertBanner.verifyAutoHides(),
    );
  }
}
