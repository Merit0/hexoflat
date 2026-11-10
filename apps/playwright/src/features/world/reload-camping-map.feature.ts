import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';

export class ReloadCampingMapFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  async reload(): Promise<void> {
    await this.step('Reload the camping map', async () => {
      await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.settleInventorySync());
      await this.campingMap.reload();
      await this.campingMap.waitUntilReady();
    });
  }
}
