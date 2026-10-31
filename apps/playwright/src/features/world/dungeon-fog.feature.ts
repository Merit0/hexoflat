import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { SquadActionsFeature } from '@features/world/squad-actions.feature';

export class DungeonFogFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  async openTheCaveAndVerifyItsMistHex(): Promise<void> {
    await this.step('The generated cave covers its hidden hexes with the mist hex', async () => {
      const verifyLoaded = await this.campingMap.hexBoard.watchSprite(/fog-hex\.png/);
      await new SquadActionsFeature().openCave();
      await verifyLoaded();
    });
  }
}
