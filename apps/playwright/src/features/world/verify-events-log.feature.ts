import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';

export class VerifyEventsLogFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  async verifyIsVisible(): Promise<void> {
    await this.step('Verify the events log is visible', () =>
      this.campingMap.eventsLog.verifyIsVisible(),
    );
  }

  async verifyClearButtonIsVisible(): Promise<void> {
    await this.step('Verify the events log Clear button is visible', () =>
      this.campingMap.eventsLog.verifyClearButtonVisible(),
    );
  }

  async verifyRowCount(count: number): Promise<void> {
    await this.step(`Verify the events log has ${count} row(s)`, () =>
      this.campingMap.eventsLog.verifyRowCount(count),
    );
  }
}
