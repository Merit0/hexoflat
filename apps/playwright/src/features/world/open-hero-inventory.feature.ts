import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';

export class OpenHeroInventoryFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  async open(): Promise<void> {
    await this.step('Open the hero-inventory overlay', () => this.campingMap.inventory.open());
  }
}
