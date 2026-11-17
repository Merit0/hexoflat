import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';

export class FillEventsLogFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  async fill(count: number): Promise<void> {
    await this.step(`Fill the events log with ${count} events`, () =>
      this.campingMap.eventsLog.fillWithTestEvents(count),
    );
  }
}
