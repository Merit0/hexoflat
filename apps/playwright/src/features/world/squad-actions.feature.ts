import { expect } from '@playwright/test';
import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { DragInventoryItemFeature } from '@features/world/drag-inventory-item.feature';
import { SwitchHeroBoardTabFeature } from '@features/world/switch-hero-board-tab.feature';
import { UseHeroToolFeature } from '@features/world/use-hero-tool.feature';
import { Tool } from '@config/hero-tool';
import { EquipSlot } from '@config/equip-slot';
import { HexobjectKeys } from '@config/test-data';
import type { TestHexCoordinates } from '@framework/test-api';

/**
 * A squad is a creature hexobject: the hand dragged onto it offers its
 * top-priority action, ATTACK, through the ordinary tool hex (B6b). The squad is placed
 * next to the hero by a test hook, because reaching one in the generated
 * cave is random and costly.
 */
export class SquadActionsFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();
  private squadAt: TestHexCoordinates | null = null;

  async placeSquadNextToHero(key: string): Promise<void> {
    await this.step(`Place a "${key}" squad next to the hero`, async () => {
      this.squadAt = await this.campingMap.hexBoard.placeSquadNextToHero(key);
    });
  }

  private requireSquad(): TestHexCoordinates {
    if (!this.squadAt) throw new Error('Place a squad first.');
    return this.squadAt;
  }

  async aimHandAtSquad(): Promise<void> {
    await this.step('Drag the hand onto the squad', async () => {
      await new UseHeroToolFeature(Tool.HAND).use();
      await this.campingMap.hexBoard.hoverTile(this.requireSquad());
    });
  }

  async verifyHandOffersAttack(): Promise<void> {
    await this.step('The tool hex offers ATTACK on the squad', async () => {
      await this.campingMap.toolActionOverlay.verifyOfferedAction(/Атакувати|Attack/);
    });
  }

  async attack(): Promise<void> {
    await this.step('Attack the squad', async () => {
      await this.campingMap.toolActionOverlay.triggerAction();
    });
  }

  async verifyBattleOpenAtOnce(): Promise<void> {
    await this.step(
      'The battle opens at once, with no deploy card, for the engaged squad',
      async () => {
        await this.campingMap.battleTab.verifyBoardOpen();
        await expect.poll(() => this.campingMap.hexBoard.isBattleEngaged()).toBe(true);
      },
    );
  }

  async openCave(): Promise<void> {
    await this.step('Open the generated cave with enough Will to enter', async () => {
      await new OpenCampingMapFeature().open();
      this.campingMap.pageErrors.watch();
      await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.prepareKnowledgeWorld(40));
      await this.page.goto('/world/cave');
      await this.campingMap.hexBoard.waitForReady();
    });
  }

  async startBattle(): Promise<void> {
    await this.step('The battle starts straight from the attack', async () => {
      await this.campingMap.battleTab.verifyBoardOpen();
    });
  }

  async winAndLeaveBattle(): Promise<void> {
    await this.step('Win the battle and press LEAVE BATTLE', async () => {
      await this.campingMap.hexBoard.finishBattle('victory');
      await this.campingMap.battleTab.leaveBattle();
    });
  }

  async verifyBoardIsBackWithoutErrors(): Promise<void> {
    await this.step('The map is back, the battle is closed and nothing threw', async () => {
      await this.campingMap.battleTab.verifyBoardClosed();
      await expect.poll(() => this.campingMap.hexBoard.isBattleEngaged()).toBe(false);
      await this.campingMap.pageErrors.verifyNone();
    });
  }

  async grantShieldToTheBag(): Promise<void> {
    await this.step('Put a shield in the bag', async () => {
      await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.grantInventoryItem('shield', 1));
    });
  }

  async giveHeroTheTurn(): Promise<void> {
    await this.step('Give the hero the turn with the full Will', async () => {
      await this.campingMap.hexBoard.giveHeroTheTurn();
      await this.campingMap.battleTab.waitForBoardStill();
    });
  }

  async equipShieldInTheInventory(): Promise<void> {
    await this.step('Drag the shield into the left hand slot of the inventory', async () => {
      await new SwitchHeroBoardTabFeature().switchTo('inventory');
      await new DragInventoryItemFeature().dragToEquipSlot(HexobjectKeys.shield, EquipSlot.SHIELD);
      await new SwitchHeroBoardTabFeature().switchTo('battle');
    });
  }

  async verifyBattleHandHoldsTheShield(): Promise<void> {
    await this.step('The battle hand holds the shield and the swap price was paid', async () => {
      await expect
        .poll(() => this.campingMap.hexBoard.readBattleHands())
        .toEqual({ right: null, left: 'wooden-shield', bag: [], will: 16 });
    });
  }
}
