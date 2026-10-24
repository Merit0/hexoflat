import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { OpenCampingMapFeature } from './open-camping-map.feature';
import '@framework/test-api';

const WILL_FOR_THE_WALK = 40;

export class BoardExitFeature extends BaseFeature {
  private readonly map = new CampingMapPage();

  private async enterSilesia(): Promise<void> {
    await new OpenCampingMapFeature().open();
    await this.page.evaluate(
      (current) => window.__HEXOFLAT_TEST__!.prepareKnowledgeWorld(current),
      WILL_FOR_THE_WALK,
    );
    await this.page.goto('/world/silesia');
    await this.map.hexBoard.waitForReady();
  }

  private async walkOntoExit(side: 'N' | 'S'): Promise<void> {
    await this.page.evaluate(
      (exitSide) => window.__HEXOFLAT_TEST__!.placeHeroBesideExit(exitSide),
      side,
    );
    await this.map.hexBoard.verifyHeroBesideExit(side);
    const exit = await this.map.hexBoard.requireExitTile(side);
    await this.map.hexBoard.clickTile(exit);
  }

  private async reloadBoard(): Promise<void> {
    await this.map.reload();
    await this.map.hexBoard.waitForReady();
  }

  async verifyWalkOutAndBack(): Promise<void> {
    await this.step('Walking onto the north exit leads to the neighbour and back', async () => {
      await this.enterSilesia();

      await this.walkOntoExit('N');
      await this.map.verifyUrlMatches(/\/world\/silesia-north/);
      await this.map.hexBoard.waitForReady();
      await this.map.hexBoard.verifyHeroBesideExit('S');

      const exit = await this.map.hexBoard.requireExitTile('S');
      await this.map.hexBoard.clickTile(exit);
      await this.map.verifyUrlMatches(/\/world\/silesia(?!-)/);
      await this.map.hexBoard.waitForReady();
      await this.map.hexBoard.verifyHeroBesideExit('N');
    });
  }

  async verifyNeighbourPlaceSurvivesReload(): Promise<void> {
    await this.step(
      'A hero on the neighbouring board keeps its board and place on reload',
      async () => {
        await this.enterSilesia();
        await this.walkOntoExit('N');
        await this.map.verifyUrlMatches(/\/world\/silesia-north/);
        await this.map.hexBoard.waitForReady();

        const place = await this.map.hexBoard.moveOneStep();
        await this.reloadBoard();

        await this.map.verifyUrlMatches(/\/world\/silesia-north/);
        await this.map.hexBoard.verifyHeroSettledAt(place);
      },
    );
  }
}
