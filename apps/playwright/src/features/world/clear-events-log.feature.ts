import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';

export class ClearEventsLogFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  async clear(): Promise<void> {
    await this.step('Clear the events log', () => this.campingMap.eventsLog.clickClear());
  }
}
