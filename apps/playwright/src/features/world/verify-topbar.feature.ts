import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';

export class VerifyTopbarFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  async verifyStepsChanged(previous: string): Promise<void> {
    await this.step('Verify the steps counter changed', () =>
      this.campingMap.topbar.verifyStepsTextChangedFrom(previous),
    );
  }
}
