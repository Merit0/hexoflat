import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { OpenCampingMapFeature } from './open-camping-map.feature';
import { DragInventoryItemFeature } from './drag-inventory-item.feature';
import { SwitchHeroBoardTabFeature } from './switch-hero-board-tab.feature';
import { VerifyHeroBoardFeature } from './verify-hero-board.feature';
import { VerifyInventoryFeature } from './verify-inventory.feature';
import { UseHeroToolFeature } from './use-hero-tool.feature';
import { HexobjectKeys } from '@config/test-data';
import { EquipSlot } from '@config/equip-slot';
import { Tool } from '@config/hero-tool';
import '@framework/test-api';

const FIREPLACE_TICK_TIMEOUT_MS = 30_000;

/**
 * The +1 heart shield and the maximum-health rule: a full hero stays full when the maximum grows,
 * a hurt hero keeps his health, removing the shield clamps health, and healing respects the raised
 * maximum. Health is read from the app through `getHeroHealth`, never recomputed here.
 */
export class ShieldMaxHealthFeature extends BaseFeature {
  private readonly map = new CampingMapPage();
  private readonly board = new VerifyHeroBoardFeature();
  private readonly tabs = new SwitchHeroBoardTabFeature();

  async startWithShieldInBag(health?: number): Promise<void> {
    await this.step('Start in camp with a shield in the bag', async () => {
      await new OpenCampingMapFeature().open();
      await this.page.evaluate((current) => {
        window.__HEXOFLAT_TEST__!.grantInventoryItem('shield', 1);
        if (current !== undefined) window.__HEXOFLAT_TEST__!.setHeroHealth(current);
      }, health);
      await new VerifyInventoryFeature().verifyContainsItem(HexobjectKeys.shield);
    });
  }

  async setHealth(current: number): Promise<void> {
    await this.step(`Set the hero health to ${current}`, () =>
      this.page.evaluate((value) => window.__HEXOFLAT_TEST__!.setHeroHealth(value), current),
    );
  }

  async equipShield(): Promise<void> {
    await this.step('Equip the shield', async () => {
      await this.tabs.switchTo('inventory');
      await new DragInventoryItemFeature().dragToEquipSlot(HexobjectKeys.shield, EquipSlot.SHIELD);
    });
  }

  async takeShieldOffWithTheHandIcon(): Promise<void> {
    await this.step('Take the shield off with the left hand icon', async () => {
      await this.tabs.switchTo('hero');
      await this.board.emptyHandByIcon('left');
    });
  }

  async verifyHealth(current: number, max: number): Promise<void> {
    await this.step(`Verify the hero has ${current}/${max} hearts`, async () => {
      await this.map.heroBoardPanel.verifyHeroHealth({ current, max });
      await this.tabs.switchTo('hero');
      await this.board.verifyHeartsMatchHealth();
    });
  }

  async verifyHealthEventually(current: number, max: number): Promise<void> {
    await this.step(`Verify the hero heals up to ${current}/${max}`, () =>
      this.map.heroBoardPanel.verifyHeroHealthWithin({ current, max }, FIREPLACE_TICK_TIMEOUT_MS),
    );
  }

  async useFireplace(): Promise<void> {
    await this.step('Rest at the fireplace', async () => {
      const fireplace = await this.map.hexBoard.requireSingleTileWithKey(HexobjectKeys.fireplace);
      await this.map.hexBoard.moveAdjacentTo(fireplace);
      await new UseHeroToolFeature(Tool.HAND).use();
      await this.map.hexBoard.hoverTile(fireplace);
      await this.map.toolActionOverlay.triggerAction();
    });
  }

  async verifyFireplaceRefusesAsFull(): Promise<void> {
    await this.step('Resting at the fireplace says health is already full', async () => {
      await this.useFireplace();
      await this.map.actionAlertBanner.verifyIsVisibleMatching(/already full|вже повне/i);
    });
  }
}
