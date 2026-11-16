import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { OpenCampingMapFeature } from './open-camping-map.feature';
import '@framework/test-api';

const WILL_FOR_THE_WALK = 40;

export class WorldDeepLinkFeature extends BaseFeature {
  private readonly map = new CampingMapPage();

  private async standInSilesia(): Promise<void> {
    await new OpenCampingMapFeature().open();
    await this.page.evaluate(
      (current) => window.__HEXOFLAT_TEST__!.prepareKnowledgeWorld(current),
      WILL_FOR_THE_WALK,
    );
    await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.settleInventorySync());
  }

  private async verifyShowsSilesia(): Promise<void> {
    await this.map.hexBoard.waitForReady();
    await this.map.verifyUrlMatches(/\/world\/silesia$/);
    await this.map.hexBoard.verifyLocation('silesia');
  }

  async verifyLinkToAnotherLocationShowsTheHerosPlace(): Promise<void> {
    await this.step('A link to the cave opens Silesia, where the hero stands', async () => {
      await this.standInSilesia();
      await this.page.goto('/world/cave');
      await this.verifyShowsSilesia();
    });
    await this.step('The hero walks on in Silesia and stays there after a reload', async () => {
      await this.map.hexBoard.moveOneStep();
      await this.map.hexBoard.verifyLocation('silesia');
      await this.map.reload();
      await this.verifyShowsSilesia();
    });
  }
}
