import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { MoveHeroFeature } from './move-hero.feature';
import { UseHeroToolFeature } from './use-hero-tool.feature';
import { Tool } from '@config/hero-tool';
import { tokenCoordinates } from '@config/test-data';
import '@framework/test-api';

export class KnowledgeHallFeature extends BaseFeature {
  private readonly camp = new CampingMapPage();
  async openHall(): Promise<void> {
    await this.step('Open the physical Camp book with the hand', async () => {
      await new MoveHeroFeature().moveAdjacentTo('knowledgeBook');
      await new UseHeroToolFeature(Tool.HAND).use();
      await this.camp.hexBoard.hoverTile(tokenCoordinates('knowledgeBook'));
      await this.camp.toolActionOverlay.triggerAction();
    });
  }
  async verifyStartingWill(): Promise<void> {
    await this.step('Verify a new hero starts below capacity and may open the Hall', () =>
      this.camp.knowledge.verifyStartingWill(),
    );
  }
  async verifyFull(): Promise<void> {
    await this.step('Verify full Will disables Hall and explains why', () =>
      this.camp.knowledge.verifyFull(),
    );
  }
  async exhaustWorldWill(): Promise<void> {
    await this.step('Spend the last Will on an actual world step', async () => {
      await this.camp.knowledge.close();
      await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.prepareKnowledgeWorld(1));
      await this.page.goto('/world/silesia');
      await this.camp.hexBoard.waitForReady();
      await this.camp.hexBoard.moveOneStep();
      await this.camp.knowledge.verifyWill(0);
    });
  }
  async completeReturn(correct: number): Promise<void> {
    await this.step('Complete the emergency return challenge', async () => {
      await this.camp.knowledge.offerReturn();
      await this.camp.knowledge.start();
      for (let i = 0; i < 20; i++) await this.camp.knowledge.answer(i < correct);
      await this.camp.knowledge.verifyResult(correct * 5);
      await this.camp.knowledge.returnHome();
      await this.camp.knowledge.verifyWill(0);
    });
  }
  async completeHall(correct: number, expectedWill: number, reload = false): Promise<void> {
    await this.step('Complete Hall and claim a capped reward', async () => {
      await this.camp.knowledge.start();
      for (let i = 0; i < 20; i++) {
        if (reload && i === 10) {
          await this.camp.reload();
          await this.camp.waitUntilReady();
          await this.openHall();
          await this.camp.knowledge.verifyQuestionIndex(10);
        }
        if (reload && i === 0) await this.camp.knowledge.verifyMobileQuestion();
        else await this.camp.knowledge.answer(i < correct);
      }
      await this.camp.knowledge.verifyResult(correct * 5);
      await this.camp.knowledge.claim(expectedWill);
      await this.camp.knowledge.captureDesktop();
    });
  }
}
