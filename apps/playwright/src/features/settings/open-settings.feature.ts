import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';

export class OpenSettingsFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  async open(): Promise<void> {
    await this.step('Open the settings overlay', async () => {
      await this.campingMap.mapSessionControls.clickSettings();
      await this.campingMap.settingsOverlay.verifyIsOpen();
    });
  }
}
