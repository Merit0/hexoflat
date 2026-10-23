import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';

export class VerifyToolActionFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  async verifyToolHexVisible(): Promise<void> {
    await this.step('Verify the tool hex is shown on the map', () =>
      this.campingMap.toolActionOverlay.verifyToolHexVisible(),
    );
  }

  async verifyToolHexHidden(): Promise<void> {
    await this.step('Verify the tool hex is gone from the map', () =>
      this.campingMap.toolActionOverlay.verifyToolHexHidden(),
    );
  }

  async verifyActionNoLongerOffered(): Promise<void> {
    await this.step('Verify the tool overlay stops offering the action', () =>
      this.campingMap.toolActionOverlay.verifyActionIsNoLongerOffered(),
    );
  }
}
