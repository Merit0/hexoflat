import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { OpenCampingMapFeature } from './open-camping-map.feature';
import { UseHeroToolFeature } from './use-hero-tool.feature';
import { Tool } from '@config/hero-tool';
import { MoveHeroFeature } from './move-hero.feature';
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
    await this.step('A hero with no Will cannot walk away', async () => {
      await this.enterSilesia(0);
      const before = await this.map.hexBoard.requireHeroCoordinates();
      await this.map.hexBoard.tryStepAndVerifyBlocked();
      await this.map.hexBoard.verifyHeroSettledAt(before);
      await this.map.knowledge.verifyWill(0);
    });
  }

  async verifyPaidEntranceLocksWhenWillIsShort(): Promise<void> {
    await this.step('A paid entrance is locked with a warning when Will is short', async () => {
      const entrance = tokenCoordinates('caveEntrance');
      await this.enterSilesia(40);
      await this.map.hexBoard.moveAdjacentTo(entrance);
      await new UseHeroToolFeature(Tool.HAND).use();
      await this.map.hexBoard.hoverTile(entrance);
      await this.map.toolActionOverlay.verifyActionIsAffordable();
      await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.setWill(1));
      await this.map.toolActionOverlay.verifyInsufficientWill();
    });
  }

  private async currentWill(): Promise<number> {
    const state = await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getKnowledge());
    if (!state) throw new Error('No Will state');
    return state.current;
  }

  async verifyCampStepsAreFree(): Promise<void> {
    await this.step('Walking around the Camp never spends Will', async () => {
      await new OpenCampingMapFeature().open();
      const before = await this.currentWill();
      await new MoveHeroFeature().moveSteps(3);
      await this.map.knowledge.verifyWill(before);
    });
  }

  async verifyEnteringCavePaysAndLeavingIsFree(cost: number): Promise<void> {
    await this.step('Entering the cave spends its price, leaving it is free', async () => {
      const entrance = tokenCoordinates('caveEntrance');
      await this.enterSilesia(40);
      await this.map.hexBoard.moveAdjacentTo(entrance);
      const before = await this.currentWill();
      await new UseHeroToolFeature(Tool.HAND).use();
      await this.map.hexBoard.hoverTile(entrance);
      await this.map.toolActionOverlay.triggerAction();
      await this.map.verifyUrlMatches(/\/world\/cave/);
      await this.map.knowledge.verifyWill(before - cost);

      await this.map.hexBoard.waitForReady();
      await new UseHeroToolFeature(Tool.HAND).use();
      await this.map.hexBoard.hoverNeighborWithKey('cave-exit');
      await this.map.toolActionOverlay.triggerAction();
      await this.map.verifyUrlMatches(/\/world\/silesia/);
      await this.map.knowledge.verifyWill(before - cost);
    });
  }
}
