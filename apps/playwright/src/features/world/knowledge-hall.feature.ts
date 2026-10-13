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
  async earnWillInHall(correct: number, wrong: number, reload = false): Promise<void> {
    await this.step('Earn Will one answered question at a time', async () => {
      await this.camp.knowledge.start();
      await this.camp.knowledge.verifyMobileQuestion();
      for (let i = 0; i < correct; i++) {
        if (reload && i === Math.floor(correct / 2)) {
          const saved = await this.page.evaluate(
            () => window.__HEXOFLAT_TEST__!.getKnowledge()!.current,
          );
          await this.camp.reload();
          await this.camp.waitUntilReady();
          await this.camp.knowledge.verifyWill(saved);
          await this.openHall();
          await this.camp.knowledge.verifyFreshStart();
          await this.camp.knowledge.start();
        }
        await this.camp.knowledge.answerCorrectlyAndVerifyAward();
      }
      for (let i = 0; i < wrong; i++) await this.camp.knowledge.answerWrongAndVerifyNoAward();
      await this.camp.knowledge.captureDesktop();
    });
  }
  async fillToCapacity(): Promise<void> {
    await this.step(
      'Answer the last needed question, reach capacity and end the lesson',
      async () => {
        await this.page.evaluate(() => {
          const api = window.__HEXOFLAT_TEST__!;
          api.setWill(api.getKnowledgeRules().capacity - 1);
        });
        await this.camp.knowledge.answerCorrectlyAndVerifyAward();
        await this.camp.knowledge.verifyHallIsDone();
        await this.camp.knowledge.verifyFull();
      },
    );
  }
  async startHall(): Promise<void> {
    await this.step('Start a Hall challenge', () => this.camp.knowledge.start());
  }
  async answerQuestions(count: number, correct = true): Promise<void> {
    await this.step(`Answer ${count} Hall question(s)`, async () => {
      for (let i = 0; i < count; i++) await this.camp.knowledge.answer(correct);
    });
  }
  async answerWithoutRejection(): Promise<void> {
    await this.step('Pick the correct answer and see it accepted', () =>
      this.camp.knowledge.pickCorrectAnswerAndVerifyAccepted(),
    );
  }
  async interruptWithEscape(): Promise<void> {
    await this.step(
      'Interrupt the Hall with Escape; reopening starts from the initial state',
      async () => {
        await this.camp.knowledge.pressEscape();
        await this.camp.knowledge.verifyClosed();
        await this.openHall();
        await this.camp.knowledge.verifyOpen();
        await this.camp.knowledge.verifyFreshStart();
      },
    );
  }
  async verifyHeroCannotMoveWhileOpen(): Promise<void> {
    await this.step(
      'Clicking a hex while the Hall is open explains why the hero stays',
      async () => {
        const from = await this.camp.hexBoard.requireHeroCoordinates();
        const pattern = /Закрий Книгу Волі|Close the Book of Will/;
        let told = false;
        for (const candidate of await this.camp.hexBoard.getFreeNeighbors()) {
          await this.camp.hexBoard.clickTileAndDismissDetails(candidate);
          told = await this.camp.actionAlertBanner.appearsMatching(pattern);
          if (told) break;
        }
        if (!told) await this.camp.actionAlertBanner.verifyIsVisibleMatching(pattern);
        await this.camp.hexBoard.verifyHeroSettledAt(from);
      },
    );
  }
  async verifyMistakeShowsCorrectAnswerThenAdvances(): Promise<void> {
    await this.step('A wrong answer pauses on the correct one, then moves on by itself', () =>
      this.camp.knowledge.verifyCorrectAnswerShownAfterMistake(),
    );
  }
  async verifyHelpTooltip(): Promise<void> {
    await this.step('Hovering the question mark explains the Book of Will', () =>
      this.camp.knowledge.verifyHelpTooltipOnHover(),
    );
  }
}
