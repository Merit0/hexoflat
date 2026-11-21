import { expect } from '@playwright/test';
import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { OpenCampingMapFeature } from './open-camping-map.feature';
import { VerifyInventoryFeature } from './verify-inventory.feature';
import { SwitchHeroBoardTabFeature } from './switch-hero-board-tab.feature';
import { SquadActionsFeature } from './squad-actions.feature';
import { EquipSlot } from '@config/equip-slot';
import '@framework/test-api';

export class HealOnBlockFeature extends BaseFeature {
  private readonly map = new CampingMapPage();

  async start(bonus: number, equipped: boolean, health = 1): Promise<void> {
    await this.step(
      `Enter battle with shield healing ${bonus}/2, equipped: ${equipped}`,
      async () => {
        await new OpenCampingMapFeature().open();
        const grants = new VerifyInventoryFeature();
        const plain = await grants.givenTokenItem({
          type: 'shield',
          realm: 'idol',
          mapTier: 1,
          attributes: [],
        });
        const healing = await grants.givenTokenItem({
          type: 'shield',
          realm: 'idol',
          mapTier: bonus as 1 | 2 | 3 | 4,
          attributes: [{ key: 'heal-on-block', value: bonus }],
        });
        const tokenId = equipped ? healing.id : plain.id;
        const id = await this.page.evaluate(
          (token) => window.__HEXOFLAT_TEST__!.getInventoryItemIdByTokenId(token),
          tokenId,
        );
        if (!id) throw new Error('No shield token');
        const tabs = new SwitchHeroBoardTabFeature();
        await tabs.switchTo('inventory');
        await this.map.inventory.dragTokenToEquipSlot(id, EquipSlot.SHIELD);
        await tabs.switchTo('hero');
        await this.page.evaluate(async (current) => {
          await window.__HEXOFLAT_TEST__!.setHeroHealth(current);
          await window.__HEXOFLAT_TEST__!.settleInventorySync();
        }, health);
        const squad = new SquadActionsFeature();
        await squad.placeSquadNextToHero('lone-skeleton');
        await squad.aimHandAtSquad();
        await squad.attack();
        await squad.startBattle();
        await this.map.battleTab.waitForBoardStill();
      },
    );
  }

  async blockAndVerify(hp: number, takeHit = false): Promise<void> {
    await this.step('Resolve a real incoming strike with a shield or TAKE HIT', async () => {
      await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.prepareShieldStrike());
      if (takeHit) await this.map.battleTab.takeHit();
      else {
        const state = await this.map.hexBoard.readBattleSnapshot();
        const attacker = state!.creatures.find(
          (creature) => creature.id === state!.reaction!.attackerId,
        )!;
        const point = await this.map.hexBoard.battleHexPoint({ q: attacker.q, r: attacker.r });
        if (!point) throw new Error('No incoming attacker on the board');
        await this.map.battleTab.clickBoardPoint(point);
        await this.map.battleTab.verifyShieldCount(1, 1);
      }
      await expect
        .poll(() =>
          this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getBattleSnapshot()?.reaction),
        )
        .toBeNull();
      await this.verifyHp(hp);
    });
  }

  async reloadAndVerify(hp: number): Promise<void> {
    await this.step('Reload the authoritative health after shield healing', async () => {
      await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.settleInventorySync());
      await this.map.reload();
      await this.map.activeBoard.waitForReady();
      await this.verifyHp(hp);
    });
  }

  private async verifyHp(hp: number): Promise<void> {
    await expect
      .poll(() =>
        this.page.evaluate(
          () =>
            window
              .__HEXOFLAT_TEST__!.getBattleSnapshot()
              ?.creatures.find((creature) => creature.side === 'heroes')?.hp,
        ),
      )
      .toBe(hp);
  }
}
