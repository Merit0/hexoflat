import { expect } from '@playwright/test';
import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { OpenCampingMapFeature } from './open-camping-map.feature';
import { VerifyInventoryFeature } from './verify-inventory.feature';
import { SwitchHeroBoardTabFeature } from './switch-hero-board-tab.feature';
import { SquadActionsFeature } from './squad-actions.feature';
import { EquipSlot } from '@config/equip-slot';
import '@framework/test-api';

export class EquipmentBlockFeature extends BaseFeature {
  private readonly map = new CampingMapPage();
  private replacement = '';

  async start(bonus: 1 | 2 | 3 | 4, equipped: boolean): Promise<void> {
    await this.step(`Enter battle with Block +${bonus}, equipped: ${equipped}`, async () => {
      await new OpenCampingMapFeature().open();
      const grants = new VerifyInventoryFeature();
      const plain = await grants.givenTokenItem({
        type: 'shield',
        realm: 'idol',
        mapTier: 1,
        attributes: [],
      });
      const shield = await grants.givenTokenItem({
        type: 'shield',
        realm: 'idol',
        mapTier: bonus,
        attributes: [{ key: 'shield', value: bonus }],
      });
      this.replacement = plain.id;
      await this.equip(equipped ? shield.id : plain.id);
      const squad = new SquadActionsFeature();
      await squad.placeSquadNextToHero('lone-skeleton');
      await squad.aimHandAtSquad();
      await squad.attack();
      await squad.startBattle();
      await this.map.battleTab.waitForBoardStill();
    });
  }

  async raiseShields(capacity: number): Promise<void> {
    await this.step(`Raise exactly ${capacity} shields through board clicks`, async () => {
      await this.page.evaluate(async () => {
        await window.__HEXOFLAT_TEST__!.prepareShieldStrike(true);
        await window.__HEXOFLAT_TEST__!.holdTheWindowOpen(60_000);
      });
      const state = await this.map.hexBoard.readBattleSnapshot();
      const attacker = state!.creatures.find(
        (creature) => creature.id === state!.reaction!.attackerId,
      )!;
      const hexes = [...state!.heroFreeNeighbours, { q: attacker.q, r: attacker.r }].slice(
        0,
        capacity + 1,
      );
      if (hexes.length <= capacity) throw new Error('Not enough shield directions');
      for (const hex of hexes) {
        const point = await this.map.hexBoard.battleHexPoint(hex);
        if (!point) throw new Error('No shield direction on the board');
        await this.map.battleTab.clickBoardPoint(point);
      }
      await this.map.battleTab.verifyShieldCount(capacity, capacity);
      await expect
        .poll(() =>
          this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getBattleSnapshot()?.placedShields),
        )
        .toBe(capacity);
    });
  }

  async reloadAndVerify(capacity: number): Promise<void> {
    await this.step('Reload the saved block capacity and raised shields', async () => {
      await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.settleInventorySync());
      await this.map.reload();
      await this.map.activeBoard.waitForReady();
      await this.map.battleTab.verifyShieldCount(capacity, capacity);
    });
  }

  async replaceWithPlainShield(): Promise<void> {
    await this.step('Replace the bonus shield with the plain bag token', async () => {
      await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.giveHeroTheTurn(20));
      await this.equip(this.replacement);
      await new SwitchHeroBoardTabFeature().switchTo('battle');
    });
  }

  private async equip(tokenId: string): Promise<void> {
    const id = await this.page.evaluate(
      (token) => window.__HEXOFLAT_TEST__!.getInventoryItemIdByTokenId(token),
      tokenId,
    );
    if (!id) throw new Error('No shield token');
    const tabs = new SwitchHeroBoardTabFeature();
    await tabs.switchTo('inventory');
    await this.map.inventory.dragTokenToEquipSlot(id, EquipSlot.SHIELD);
    await tabs.switchTo('hero');
  }
}
