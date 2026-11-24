import { expect } from '@playwright/test';
import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { OpenCampingMapFeature } from './open-camping-map.feature';
import { DragInventoryItemFeature } from './drag-inventory-item.feature';
import { SquadActionsFeature } from './squad-actions.feature';
import { SwitchHeroBoardTabFeature } from './switch-hero-board-tab.feature';
import { UseEquippedToolFeature } from './use-equipped-tool.feature';
import { VerifyInventoryFeature } from './verify-inventory.feature';
import { EquipSlot } from '@config/equip-slot';
import { HexobjectKeys } from '@config/test-data';
import '@framework/test-api';

export class SwapHandsFeature extends BaseFeature {
  private readonly map = new CampingMapPage();
  private readonly drag = new DragInventoryItemFeature();
  private readonly inventory = new VerifyInventoryFeature();

  async openCampHolding(held: Partial<Record<'weapon' | 'shield', string>>): Promise<void> {
    await this.step('Open the camp with gear in the hands', async () => {
      await new OpenCampingMapFeature().open();
      await new SwitchHeroBoardTabFeature().switchTo('inventory');
      for (const [slot, key] of Object.entries(held)) {
        await this.inventory.givenTokenItem({
          type: key,
          tokenType: 'idol',
          mapTier: 1,
          attributes: [],
        });
        await this.drag.dragToEquipSlot(key, slot as EquipSlot);
        await this.inventory.verifyItemEquipped(key, slot as EquipSlot);
      }
    });
  }

  async dragToHand(itemKey: string, slot: EquipSlot): Promise<void> {
    await this.drag.dragEquippedToEquipSlot(itemKey, slot);
  }

  async verifyHands(weapon: string, shield: string): Promise<void> {
    await this.step(
      `Verify "${weapon}" is in the right hand and "${shield}" in the left`,
      async () => {
        await this.inventory.verifyItemEquipped(weapon, EquipSlot.WEAPON);
        await this.inventory.verifyItemEquipped(shield, EquipSlot.SHIELD);
      },
    );
  }

  async reloadInventory(): Promise<void> {
    await this.step('Reload the page and open the inventory again', async () => {
      await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.settleInventorySync());
      await this.map.reload();
      await this.map.waitUntilReady();
      await new SwitchHeroBoardTabFeature().switchTo('inventory');
    });
  }

  async attackWithTheSword(): Promise<void> {
    await this.step('Attack a squad with the sword in either hand', async () => {
      const squad = new SquadActionsFeature();
      await squad.placeSquadNextToHero('lone-skeleton');
      await new UseEquippedToolFeature().use(HexobjectKeys.sword);
      await squad.hoverSquad();
      await squad.attack();
      await squad.startBattle();
      await this.map.battleTab.waitForBoardStill();
    });
  }

  async swapInBattle(itemKey: string, slot: EquipSlot): Promise<void> {
    await this.step(`Drag "${itemKey}" to the "${slot}" hand during the battle`, async () => {
      await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.giveHeroTheTurn(20));
      const tabs = new SwitchHeroBoardTabFeature();
      await tabs.switchTo('inventory');
      await this.drag.dragEquippedToEquipSlot(itemKey, slot);
      await tabs.switchTo('battle');
    });
  }

  async verifyBattleHands(right: string, left: string): Promise<void> {
    await this.step(`Verify the battle hands: right "${right}", left "${left}"`, () =>
      expect
        .poll(() => this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getBattleHands()))
        .toMatchObject({ right, left }),
    );
  }
}
