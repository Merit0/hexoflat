import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';

export class ToggleHeroBoardFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  async collapse(): Promise<void> {
    await this.step('Collapse the hero board panel', async () => {
      await this.campingMap.heroBoardPanel.clickToggleRail();
      await this.campingMap.heroBoardPanel.verifyPanelCollapsed();
    });
  }

  async expand(): Promise<void> {
    await this.step('Expand the hero board panel', async () => {
      await this.campingMap.heroBoardPanel.clickToggleRail();
      await this.campingMap.heroBoardPanel.verifyPanelOpen();
    });
  }
}
