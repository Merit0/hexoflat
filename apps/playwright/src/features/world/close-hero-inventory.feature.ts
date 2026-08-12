import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';

export class CloseHeroInventoryFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  async close(): Promise<void> {
    await this.step('Close the hero-inventory overlay', () => this.campingMap.inventory.close());
  }
}
