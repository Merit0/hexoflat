import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import type { HeroBoardTab } from '@components/hero-board-panel.component';

export class SwitchHeroBoardTabFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  async switchTo(tab: HeroBoardTab): Promise<void> {
    await this.step(`Switch the hero board to the "${tab}" tab`, async () => {
      await this.campingMap.heroBoardPanel.clickTab(tab);
      await this.campingMap.heroBoardPanel.verifyTabActive(tab);
    });
  }
}
