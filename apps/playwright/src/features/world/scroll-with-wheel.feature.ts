import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';

export class ScrollWithWheelFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  async overTheEventsLog(): Promise<void> {
    await this.step('Turn the mouse wheel over the events log', () =>
      this.campingMap.eventsLog.scrollWithTheWheel(),
    );
  }

  async overTheBoard(): Promise<void> {
    await this.step('Turn the mouse wheel over the board', () =>
      this.campingMap.hexBoard.armHandTool(),
    );
  }
}
