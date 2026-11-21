import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { EquipSlot } from '@config/equip-slot';
import { OpenCampingMapFeature } from './open-camping-map.feature';
import { SwitchHeroBoardTabFeature } from './switch-hero-board-tab.feature';
import { VerifyInventoryFeature } from './verify-inventory.feature';
import { SquadActionsFeature } from './squad-actions.feature';
import { BattleCollectFeature } from './battle-collect.feature';
import '@framework/test-api';

export class EquipmentTrophyFeature extends BaseFeature {
  private readonly map = new CampingMapPage();
  private readonly tabs = new SwitchHeroBoardTabFeature();
  private tokenId = '';

  async start(bonus: 1 | 2, equipped: boolean): Promise<void> {
    await this.step(`Start with Trophy +${bonus}, equipped: ${equipped}`, async () => {
      await new OpenCampingMapFeature().open();
      const grants = new VerifyInventoryFeature();
      const plain = await grants.givenTokenItem({
        type: 'sword',
        realm: 'idol',
        mapTier: 1,
        attributes: [],
      });
      await this.equip(plain.id);
      const trophy = await grants.givenTokenItem({
        type: 'sword',
        realm: 'idol',
        mapTier: bonus === 2 ? 4 : 1,
        attributes: [{ key: 'trophy', value: bonus }],
      });
      if (equipped) await this.equip(trophy.id);
      this.tokenId = equipped ? trophy.id : plain.id;
      const squad = new SquadActionsFeature();
      await squad.placeSquadNextToHero('lone-skeleton');
      await squad.aimHandAtSquad();
      await squad.attack();
      await squad.startBattle();
      await this.map.battleTab.waitForBoardStill();
      await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.prepareTrophyTarget());
      await this.map.battleTab.waitForBoardStill();
    });
  }

  async killAndVerify(bonus: number): Promise<void> {
    await this.step(
      'Land the lethal strike through Inventory USE and the real ATTACK action',
      async () => {
        const snapshot = await this.map.hexBoard.readBattleSnapshot();
        const enemy = snapshot!.creatures.find(
          (creature) => creature.side === 'enemies' && creature.hp > 0,
        )!;
        const point = await this.map.hexBoard.battleHexPoint({ q: enemy.q, r: enemy.r });
        if (!point) throw new Error('No target on the battle board');
        await this.map.battleTab.clickBoardPoint(point);
        await this.tabs.switchTo('inventory');
        const itemId = await this.itemId(this.tokenId);
        await this.map.inventory.useEquippedItem(itemId);
        await this.tabs.switchTo('battle');
        await this.map.battleTab.hoverBoardPoint(point);
        await this.map.battleTab.verifyToolHexOffers(/Attack|Атакувати/);
        await this.map.battleTab.pressToolHexAction();
        await this.map.battleCollect.waitForCollecting();
        await this.map.battleCollect.waitForBoardStill();
        await this.map.equipmentTrophy.verifyLethalBonus(bonus);
      },
    );
  }

  async reloadAndVerify(bonus: number): Promise<void> {
    await this.step('Reload the saved corpse and verify its captured Trophy bonus', async () => {
      await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.settleInventorySync());
      await this.map.reload();
      await this.map.activeBoard.waitForReady();
      await this.map.equipmentTrophy.verifyLethalBonus(bonus);
    });
  }

  async readAndVerifyLoot(): Promise<void> {
    await this.step(
      'Read the grave through the tool hex and preserve its loot through reload',
      async () => {
        await new BattleCollectFeature().lookThroughEveryGrave();
        await this.map.equipmentTrophy.rememberLoot();
        await this.map.reload();
        await this.map.activeBoard.waitForReady();
        await this.map.equipmentTrophy.verifyLootPreserved();
      },
    );
  }

  private async equip(tokenId: string): Promise<void> {
    await this.tabs.switchTo('inventory');
    await this.map.inventory.dragTokenToEquipSlot(await this.itemId(tokenId), EquipSlot.WEAPON);
    await this.tabs.switchTo('hero');
  }

  private async itemId(tokenId: string): Promise<string> {
    const id = await this.page.evaluate(
      (token) => window.__HEXOFLAT_TEST__!.getInventoryItemIdByTokenId(token),
      tokenId,
    );
    if (!id) throw new Error('No Trophy fixture item');
    return id;
  }
}
