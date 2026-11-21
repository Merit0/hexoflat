import { expect } from '@playwright/test';
import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { EquipSlot } from '@config/equip-slot';
import { OpenCampingMapFeature } from './open-camping-map.feature';
import { DragInventoryItemFeature } from './drag-inventory-item.feature';
import { SwitchHeroBoardTabFeature } from './switch-hero-board-tab.feature';
import '@framework/test-api';

export class EquipmentFogFeature extends BaseFeature {
  private readonly map = new CampingMapPage();
  private readonly tabs = new SwitchHeroBoardTabFeature();

  async startWithSightInBag(bonus: number): Promise<void> {
    await this.step(`Start on Silesia with an owned +${bonus} sight token in the bag`, async () => {
      await new OpenCampingMapFeature().open();
      const token = await this.page.evaluate(
        (value) => window.__HEXOFLAT_TEST__!.grantLegacySightToken(value),
        bonus,
      );
      expect(token.attributes).toEqual([{ key: 'fog', value: bonus }]);
      await this.page.evaluate(() =>
        window.__HEXOFLAT_TEST__!.prepareKnowledgeWorld(50, 'silesia'),
      );
      await this.map.activeBoard.waitForReady();
    });
  }

  async equipSight(): Promise<void> {
    await this.step('Equip the sight token with a real inventory drag', async () => {
      await this.tabs.switchTo('inventory');
      await new DragInventoryItemFeature().dragToEquipSlot('shield', EquipSlot.SHIELD);
      const id = await this.map.inventory.getItemIdByKey('shield');
      await this.map.inventory.verifyItemEquipped(id, EquipSlot.SHIELD);
      await this.tabs.switchTo('hero');
    });
  }

  async stepAndVerifyRadius(radius: number): Promise<void> {
    await this.step(
      `Walk one hex and verify exactly radius ${radius} is newly revealed`,
      async () => {
        const target = await this.map.equipmentFog.prepareStep();
        await this.map.hexBoard.clickTile(target);
        await this.map.equipmentFog.verifyRevealedRadius(radius);
      },
    );
  }

  async reloadAndVerifyFog(): Promise<void> {
    await this.step(
      'Reload and verify the same explored fog comes back from the server',
      async () => {
        await this.map.reload();
        await this.map.activeBoard.waitForReady();
        await this.map.equipmentFog.verifySavedFog();
      },
    );
  }
}
