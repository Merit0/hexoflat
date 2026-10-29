import { expect } from '@playwright/test';
import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { UseHeroToolFeature } from '@features/world/use-hero-tool.feature';
import { Tool } from '@config/hero-tool';
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

  async verifyDeployCardOpen(): Promise<void> {
    await this.step('The battle deploy card is open for the engaged squad', async () => {
      await this.campingMap.battleDeployCard.verifyIsVisible();
      await expect.poll(() => this.campingMap.hexBoard.isBattleEngaged()).toBe(true);
    });
  }
}
