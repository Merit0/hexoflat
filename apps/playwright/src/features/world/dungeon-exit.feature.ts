import { expect } from '@playwright/test';
import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { OpenCampingMapFeature } from './open-camping-map.feature';
import { UseHeroToolFeature } from './use-hero-tool.feature';
import { Tool } from '@config/hero-tool';
import { tokenCoordinates } from '@config/test-data';
import '@framework/test-api';

export class DungeonExitFeature extends BaseFeature {
  private readonly map = new CampingMapPage();

  async verifyRepeatedExitsReturnBesideTheEntrance(): Promise<void> {
    await this.step(
      'Exit the dungeon three times and remain beside its entrance after reload',
      async () => {
        await new OpenCampingMapFeature().open();
        await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.prepareKnowledgeWorld(50));
        await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.settleInventorySync());
        await this.page.goto('/world/silesia');
        await this.map.activeBoard.waitForReady();
        const entrance = tokenCoordinates('caveEntrance');
        for (let cycle = 1; cycle <= 3; cycle++) {
          await this.step(`Enter and exit through the dungeon door, cycle ${cycle}`, async () => {
            await this.page.evaluate(async () => {
              window.__HEXOFLAT_TEST__!.setWill(50);
              await window.__HEXOFLAT_TEST__!.settleInventorySync();
            });
            await this.map.hexBoard.moveAdjacentTo(entrance);
            await new UseHeroToolFeature(Tool.HAND).use();
            await this.map.hexBoard.hoverTile(entrance);
            await this.map.toolActionOverlay.triggerAction();
            await this.map.verifyUrlMatches(/\/world\/cave/);
            await this.map.activeBoard.waitForReady();
            await new UseHeroToolFeature(Tool.HAND).use();
            await this.map.hexBoard.hoverNeighborWithKey('cave-exit');
            await this.map.toolActionOverlay.triggerAction();
            await this.map.verifyUrlMatches(/\/world\/silesia/);
            await this.map.activeBoard.waitForReady();
            await this.verifyBesideEntrance();
            const position = await this.map.hexBoard.requireHeroCoordinates();
            await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.settleInventorySync());
            await this.map.reload();
            await this.map.verifyUrlMatches(/\/world\/silesia/);
            await this.map.activeBoard.waitForReady();
            await this.verifyBesideEntrance();
            await this.map.hexBoard.verifyHeroSettledAt(position);
          });
        }
      },
    );
  }

  private async verifyBesideEntrance(): Promise<void> {
    await expect
      .poll(async () => {
        const hero = await this.map.hexBoard.requireHeroCoordinates();
        return this.map.hexBoard.distanceBetween(hero, tokenCoordinates('caveEntrance'));
      })
      .toBe(1);
  }
}
