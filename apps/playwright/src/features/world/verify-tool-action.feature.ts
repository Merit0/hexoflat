import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';

export class VerifyToolActionFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  async verifyActionNoLongerOffered(): Promise<void> {
    await this.step('Verify the tool overlay stops offering the action', () =>
      this.campingMap.toolActionOverlay.verifyActionIsNoLongerOffered(),
    );
  }
}
