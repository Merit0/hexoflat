import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { OpenCampingMapFeature } from './open-camping-map.feature';
import { UseHeroToolFeature } from './use-hero-tool.feature';
import { Tool } from '@config/hero-tool';
import { tokenCoordinates } from '@config/test-data';
import '@framework/test-api';

export class WillEconomyFeature extends BaseFeature {
  private readonly map = new CampingMapPage();

  private async enterSilesia(will: number): Promise<void> {
    await new OpenCampingMapFeature().open();
    await this.page.evaluate(
      (current) => window.__HEXOFLAT_TEST__!.prepareKnowledgeWorld(current),
      will,
    );
    await this.page.goto('/world/silesia');
    await this.map.hexBoard.waitForReady();
  }

  async verifyStuckWithoutWill(): Promise<void> {
    await this.step('A hero with no Will cannot walk and is offered the way home', async () => {
      await this.enterSilesia(0);
      const before = await this.map.hexBoard.requireHeroCoordinates();
      await this.map.hexBoard.tryStepAndVerifyBlocked();
      await this.map.hexBoard.verifyHeroSettledAt(before);
      await this.map.knowledge.verifyWill(0);
      await this.map.knowledge.verifyReturnOffered();
    });
  }

  async verifyPaidEntrancePrice(cost: number): Promise<void> {
    await this.step('A paid entrance shows its price and locks when Will is short', async () => {
      const entrance = tokenCoordinates('caveEntrance');
      await this.enterSilesia(40);
      await this.map.hexBoard.moveAdjacentTo(entrance);
      await new UseHeroToolFeature(Tool.HAND).use();
      await this.map.hexBoard.hoverTile(entrance);
      await this.map.toolActionOverlay.verifyCostChip(cost);
      await this.map.toolActionOverlay.verifyActionIsAffordable();
      await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.setWill(1));
      await this.map.toolActionOverlay.verifyInsufficientWill();
    });
  }
}
