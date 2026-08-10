import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';

export class VerifySettingsOverlayFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

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
