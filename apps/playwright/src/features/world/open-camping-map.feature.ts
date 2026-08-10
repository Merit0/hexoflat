import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';

export class OpenCampingMapFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  /**
   * Navigates straight to the board using the pre-authenticated storage state
   * the worker fixture applies — so specs that don't test the login flow never
   * touch the login form, nor /auth/login's throttle bucket.
   */
  async open(): Promise<void> {
    await this.step('Open the camping map', async () => {
      await this.campingMap.goto();
      await this.campingMap.waitUntilReady();
    });
  }

  async reloadAndWaitReady(): Promise<void> {
    await this.step('Reload the camping map', async () => {
      await this.campingMap.reload();
      await this.campingMap.waitUntilReady();
    });
  }
}
