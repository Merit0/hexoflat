import { expect } from '@playwright/test';
import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { OpenCampingMapFeature } from './open-camping-map.feature';
import { SwitchHeroBoardTabFeature } from './switch-hero-board-tab.feature';
import { DragInventoryItemFeature } from './drag-inventory-item.feature';
import { SquadActionsFeature } from './squad-actions.feature';
import { EquipSlot } from '@config/equip-slot';
import { HexobjectKeys } from '@config/test-data';
import { VerifyHeroBoardFeature } from './verify-hero-board.feature';
import '@framework/test-api';

export class EquipmentUseFeature extends BaseFeature {
  private readonly map = new CampingMapPage();

  private replacementItemId: string | null = null;

  async start(bonus: number, equipped: boolean, replacementBonus?: number): Promise<void> {
    await this.step(`Start a battle with Deft Hands ${bonus}, equipped: ${equipped}`, async () => {
      await new OpenCampingMapFeature().open();
      await this.page.evaluate(async (value) => {
        await window.__HEXOFLAT_TEST__!.grantLegacyDeftHandsToken(value);
        window.__HEXOFLAT_TEST__!.grantInventoryItem('health-bottle', 1);
        await window.__HEXOFLAT_TEST__!.setHeroHealth(1.5);
        await window.__HEXOFLAT_TEST__!.settleInventorySync();
      }, bonus);
      const tabs = new SwitchHeroBoardTabFeature();
      const drag = new DragInventoryItemFeature();
      await tabs.switchTo('inventory');
      if (equipped) await drag.dragToEquipSlot(HexobjectKeys.shield, EquipSlot.SHIELD);
      if (replacementBonus !== undefined) {
        this.replacementItemId = await this.page.evaluate(async (value) => {
          const token = await window.__HEXOFLAT_TEST__!.grantLegacyDeftHandsToken(value);
          return window.__HEXOFLAT_TEST__!.getInventoryItemIdByTokenId(token.id);
        }, replacementBonus);
      }
      await tabs.switchTo('hero');
      const squad = new SquadActionsFeature();
      await squad.placeSquadNextToHero(HexobjectKeys.skeletonPack);
      await squad.aimHandAtSquad();
      await squad.attack();
      await squad.startBattle();
      await this.map.battleTab.waitForBoardStill();
      await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.giveHeroTheTurn(20));
      await this.map.battleTab.waitForBoardStill();
      await this.map.battleTab.verifyHeroCardState('act');
      await tabs.switchTo('inventory');
      await drag.dragToEquipSlot(HexobjectKeys.healthBottle, EquipSlot.WEAPON);
      await tabs.switchTo('battle');
      await this.map.equipmentUse.verifyPotionEquipped();
    });
  }

  async reload(): Promise<void> {
    await this.step('Reload the server-held battle and its equipped discount', async () => {
      await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.settleInventorySync());
      await this.map.reload();
      await this.map.waitUntilReady();
      await this.map.equipmentUse.verifyPotionEquipped();
    });
  }

  async verifyPrice(cost: number): Promise<void> {
    await this.step(`Verify the current equipment makes USE cost ${cost}`, async () => {
      await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.giveHeroTheTurn(20));
      await this.map.battleTab.scrollTheHandsWithTheWheel();
      await this.map.equipmentUse.verifyPrice(cost, true);
    });
  }

  async verifyInsufficientWill(cost: number, will: number): Promise<void> {
    await this.step(
      `USE costing ${cost} is disabled at ${will} Will and preserves saved state`,
      async () => {
        await this.page.evaluate((value) => window.__HEXOFLAT_TEST__!.giveHeroTheTurn(value), will);
        await this.map.battleTab.scrollTheHandsWithTheWheel();
        await this.map.equipmentUse.verifyPrice(cost, false);
        const before = await this.page.evaluate(() => {
          const snapshot = window.__HEXOFLAT_TEST__!.getBattleSnapshot()!;
          return {
            will: snapshot.turnWill,
            hero: snapshot.creatures.find((creature) => creature.side === 'heroes'),
            hands: window.__HEXOFLAT_TEST__!.getBattleHands(),
          };
        });
        await this.reload();
        await this.map.battleTab.scrollTheHandsWithTheWheel();
        await this.map.equipmentUse.verifyPrice(cost, false);
        const after = await this.page.evaluate(() => {
          const snapshot = window.__HEXOFLAT_TEST__!.getBattleSnapshot()!;
          return {
            will: snapshot.turnWill,
            hero: snapshot.creatures.find((creature) => creature.side === 'heroes'),
            hands: window.__HEXOFLAT_TEST__!.getBattleHands(),
          };
        });
        expect(after).toEqual(before);
      },
    );
  }

  async removeDiscount(): Promise<void> {
    await this.step('Remove the discount equipment through the left hand icon', async () => {
      await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.giveHeroTheTurn(20));
      const tabs = new SwitchHeroBoardTabFeature();
      await tabs.switchTo('hero');
      await new VerifyHeroBoardFeature().emptyHandByIcon('left');
      await tabs.switchTo('battle');
      await expect
        .poll(() => this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getBattleHands()?.left))
        .toBeNull();
    });
  }

  async replaceDiscount(): Promise<void> {
    await this.step('Replace the discount equipment with the stronger bag token', async () => {
      if (!this.replacementItemId) throw new Error('No replacement equipment was granted');
      await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.giveHeroTheTurn(20));
      const tabs = new SwitchHeroBoardTabFeature();
      await tabs.switchTo('inventory');
      await this.map.inventory.dragTokenToEquipSlot(this.replacementItemId, EquipSlot.SHIELD);
      await tabs.switchTo('battle');
    });
  }

  async drinkFor(cost: number): Promise<void> {
    await this.step(`Use the potion for exactly ${cost} Will through the battle UI`, async () => {
      await this.page.evaluate((value) => window.__HEXOFLAT_TEST__!.giveHeroTheTurn(value), cost);
      await this.map.battleTab.verifyHeroCardState('act');
      await this.map.battleTab.scrollTheHandsWithTheWheel();
      const before = await this.map.hexBoard.readBattleSnapshot();
      const hero = before!.creatures.find((creature) => creature.side === 'heroes')!;
      await this.map.equipmentUse.selectPotion(cost);
      await expect
        .poll(async () => {
          const snapshot = await this.map.hexBoard.readBattleSnapshot();
          return {
            will: snapshot?.turnWill,
            healed:
              (snapshot?.creatures.find((creature) => creature.id === hero.id)?.hp ?? 0) > hero.hp,
          };
        })
        .toEqual({ will: 0, healed: true });
      await expect
        .poll(() => this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getBattleHands()?.right))
        .toBeNull();
    });
  }
}
