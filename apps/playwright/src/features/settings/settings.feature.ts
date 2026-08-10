import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';

export class SettingsFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  async open(): Promise<void> {
    await this.step('Open the settings overlay', async () => {
      await this.campingMap.topbar.openSettings();
      await this.campingMap.settingsOverlay.verifyIsOpen();
    });
  }

  async verifyCloseButtonLabel(label: string): Promise<void> {
    await this.step(`Verify the close button reads "${label}"`, () =>
      this.campingMap.settingsOverlay.verifyCloseButtonLabel(label),
    );
  }

  async verifyLocaleSelectValue(locale: string): Promise<void> {
    await this.step(`Verify the locale select shows "${locale}"`, () =>
      this.campingMap.settingsOverlay.verifyLocaleSelectValue(locale),
    );
  }
}
