import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { OpenCampingMapFeature } from './open-camping-map.feature';
import { ShieldMaxHealthFeature } from './shield-max-health.feature';
import { KnowledgeHallFeature } from './knowledge-hall.feature';
import { SquadActionsFeature } from './squad-actions.feature';
import { SwitchHeroBoardTabFeature } from './switch-hero-board-tab.feature';
import { HexobjectKeys } from '@config/test-data';
import '@framework/test-api';

export class EquipmentFocusFeature extends BaseFeature {
  private readonly map = new CampingMapPage();
  private readonly shield = new ShieldMaxHealthFeature();

  async start(bonus: number, equipped: boolean): Promise<void> {
    await this.step(`Start with Focus +${bonus}, equipped: ${equipped}`, async () => {
      await new OpenCampingMapFeature().open();
      await this.page.evaluate(async (value) => {
        await window.__HEXOFLAT_TEST__!.grantLegacyFocusToken(value);
        window.__HEXOFLAT_TEST__!.setWill(10);
        await window.__HEXOFLAT_TEST__!.settleInventorySync();
      }, bonus);
      if (equipped) await this.shield.equipShield();
    });
  }

  async openHall(): Promise<void> {
    await this.step('Open the Hall and start answering', async () => {
      await new KnowledgeHallFeature().openHall();
      await this.map.knowledge.start();
    });
  }

  async answerHall(min: number, max = min): Promise<void> {
    await this.step(`Answer correctly and receive ${min}…${max} Will`, () =>
      this.map.equipmentFocus.answerHallAndVerify(min, max),
    );
  }

  async answerHallWrong(): Promise<void> {
    await this.step('A wrong Hall answer gives no reward', () =>
      this.map.knowledge.answerWrongAndVerifyNoAward(),
    );
  }

  async equipFromHall(): Promise<void> {
    await this.step('Close the Hall and equip the owned Focus item through Inventory', async () => {
      await this.map.knowledge.close();
      await this.shield.equipShield();
    });
  }

  async setWill(current: number): Promise<void> {
    await this.step(`Set the hero reserve to ${current}`, () =>
      this.page.evaluate(async (value) => {
        window.__HEXOFLAT_TEST__!.setWill(value);
        await window.__HEXOFLAT_TEST__!.settleInventorySync();
      }, current),
    );
  }

  async startBattle(): Promise<void> {
    await this.step('Start a real battle beside the camp squad', async () => {
      const squad = new SquadActionsFeature();
      await squad.placeSquadNextToHero(HexobjectKeys.skeletonPack);
      await squad.aimHandAtSquad();
      await squad.attack();
      await squad.startBattle();
      await this.map.battleTab.waitForBoardStill();
    });
  }

  async answerBattle(correct: boolean): Promise<void> {
    await this.step(`Answer a real timed battle task, correct: ${correct}`, async () => {
      await new SwitchHeroBoardTabFeature().switchTo('battle');
      const right = await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.openBattleTask());
      await this.map.equipmentFocus.answerBattle(correct ? right : (right + 1) % 4);
    });
  }

  async remove(): Promise<void> {
    await this.step('Remove Focus through the hand icon', () =>
      this.shield.takeShieldOffWithTheHandIcon(),
    );
  }

  async reload(): Promise<void> {
    await this.step('Reload and restore the saved Will reserve', async () => {
      await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.settleInventorySync());
      await this.map.reload();
      await this.map.activeBoard.waitForReady();
    });
  }

  async verifyWill(current: number): Promise<void> {
    await this.step(`Verify the hero has ${current} persistent Will`, () =>
      this.map.equipmentFocus.verifyWill(current),
    );
  }
}
