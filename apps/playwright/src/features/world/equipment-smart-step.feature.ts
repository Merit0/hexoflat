import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { EquipSlot } from '@config/equip-slot';
import { OpenCampingMapFeature } from './open-camping-map.feature';
import { ShieldMaxHealthFeature } from './shield-max-health.feature';
import { SwitchHeroBoardTabFeature } from './switch-hero-board-tab.feature';
import '@framework/test-api';

export class EquipmentSmartStepFeature extends BaseFeature {
  private readonly map = new CampingMapPage();
  private readonly shield = new ShieldMaxHealthFeature();

  async start(every = 5, current = 50): Promise<void> {
    await this.step(`Start in Silesia with Smart Step ${every} in the bag`, async () => {
      await new OpenCampingMapFeature().open();
      await this.page.evaluate(
        async ({ every, current }) => {
          await window.__HEXOFLAT_TEST__!.grantLegacySmartStepToken(every);
          await window.__HEXOFLAT_TEST__!.prepareKnowledgeWorld(current, 'silesia');
        },
        { every, current },
      );
      await this.map.activeBoard.waitForReady();
    });
  }

  async equip(): Promise<void> {
    await this.step('Equip Smart Step through Inventory', () => this.shield.equipShield());
  }

  async replace(every: number): Promise<void> {
    await this.step(`Replace the equipped token with Smart Step ${every}`, async () => {
      const id = await this.page.evaluate(async (value) => {
        const token = await window.__HEXOFLAT_TEST__!.grantLegacySmartStepToken(value);
        return window.__HEXOFLAT_TEST__!.getInventoryItemIdByTokenId(token.id);
      }, every);
      if (!id) throw new Error('No replacement token');
      const tabs = new SwitchHeroBoardTabFeature();
      await tabs.switchTo('inventory');
      await this.map.inventory.dragTokenToEquipSlot(id, EquipSlot.SHIELD);
      await tabs.switchTo('hero');
    });
  }

  async remove(): Promise<void> {
    await this.step('Remove Smart Step through the left hand icon', () =>
      this.shield.takeShieldOffWithTheHandIcon(),
    );
  }

  async setWill(current: number): Promise<void> {
    await this.step(`Set Will to ${current}`, () =>
      this.page.evaluate(async (value) => {
        window.__HEXOFLAT_TEST__!.setWill(value);
        await window.__HEXOFLAT_TEST__!.settleInventorySync();
      }, current),
    );
  }

  async walk(count: number): Promise<void> {
    await this.step(`Walk ${count} real world steps`, async () => {
      for (let index = 0; index < count; index++) {
        const target = await this.map.equipmentSmartStep.nextStep();
        await this.map.hexBoard.clickTile(target);
        await this.map.equipmentSmartStep.verifyPosition(target);
        await this.map.activeBoard.waitForReady();
        await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.settleInventorySync());
      }
    });
  }

  async verify(current: number, paidSteps: number): Promise<void> {
    await this.step(`Verify ${current} Will and ${paidSteps} eligible steps`, async () => {
      await new SwitchHeroBoardTabFeature().switchTo('hero');
      await this.map.equipmentSmartStep.verifyProgress(current, paidSteps);
      await this.map.equipmentWill.verifyWill(current, 50);
    });
  }

  async visitCamp(current: number): Promise<void> {
    await this.step('Visit camp without resetting the step counter', async () => {
      await this.page.evaluate(
        (value) => window.__HEXOFLAT_TEST__!.prepareKnowledgeWorld(value, 'camping'),
        current,
      );
      await this.map.waitUntilReady();
    });
  }

  async reload(): Promise<void> {
    await this.step('Reload the server-held hero and step counter', async () => {
      await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.settleInventorySync());
      await this.map.reload();
      await this.map.activeBoard.waitForReady();
    });
  }

  async verifyNextStepBlocked(): Promise<void> {
    await this.step(
      'Try the next paid step at zero Will and verify the saved position stays put',
      async () => {
        const before = await this.map.hexBoard.readHeroCoordinates();
        if (!before) throw new Error('No hero');
        await this.map.hexBoard.clickTile(await this.map.equipmentSmartStep.nextStep());
        await this.reload();
        await this.map.equipmentSmartStep.verifyPosition(before);
      },
    );
  }
}
