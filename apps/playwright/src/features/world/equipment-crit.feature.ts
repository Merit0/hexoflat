import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { EquipmentCritComponent } from '@components/equipment-crit.component';
import { EquipSlot } from '@config/equip-slot';
import { OpenCampingMapFeature } from './open-camping-map.feature';
import { SwitchHeroBoardTabFeature } from './switch-hero-board-tab.feature';
import { VerifyInventoryFeature } from './verify-inventory.feature';
import { SquadActionsFeature } from './squad-actions.feature';
import '@framework/test-api';

export class EquipmentCritFeature extends BaseFeature {
  private readonly map = new CampingMapPage();
  private readonly crit = new EquipmentCritComponent();
  private replacement = '';
  private tokenId = '';

  async start(multiplier: 2 | 3 | 4 | 5, equipped: boolean): Promise<void> {
    await this.step(
      `Start with a critical weapon x${multiplier}, equipped: ${equipped}`,
      async () => {
        await new OpenCampingMapFeature().open();
        const grants = new VerifyInventoryFeature();
        const plain = await grants.givenTokenItem({
          type: 'sword',
          tokenType: 'idol',
          mapTier: 1,
          attributes: [],
        });
        this.replacement = plain.id;
        const weapon = await grants.givenTokenItem({
          type: 'sword',
          tokenType: 'idol',
          mapTier: multiplier === 2 ? 1 : 4,
          attributes: [
            { key: 'crit-chance', value: multiplier === 2 ? 2 : 10 },
            ...(multiplier === 2 ? [] : [{ key: 'crit-dmg', value: multiplier }]),
          ],
        });
        await new SwitchHeroBoardTabFeature().switchTo('inventory');
        const itemId = await this.itemId(weapon.id);
        await this.map.inventory.hoverGridItem(itemId);
        await this.map.inventory.verifyTooltipAttributeLabel(multiplier === 2 ? /\+2%/ : /\+10%/);
        if (multiplier !== 2)
          await this.map.inventory.verifyTooltipAttributeLabel(new RegExp(`×${multiplier}`));
        await this.equip(equipped ? weapon.id : plain.id);
        const squad = new SquadActionsFeature();
        await squad.placeSquadNextToHero('lone-skeleton');
        await squad.aimHandAtSquad();
        await squad.attack();
        await squad.startBattle();
        await this.map.battleTab.waitForBoardStill();
      },
    );
  }

  async strikeAndReload(critical: boolean, damage: number): Promise<void> {
    await this.step('Strike through the real tool and reload the saved damage', async () => {
      await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.prepareCritTarget());
      await this.map.battleTab.waitForBoardStill();
      const state = await this.map.hexBoard.readBattleSnapshot();
      const target = state!.creatures.find((creature) => creature.side === 'enemies')!;
      const point = await this.map.hexBoard.battleHexPoint(target);
      if (!point) throw new Error('No critical target on the board');
      await this.map.battleTab.clickBoardPoint(point);
      const tabs = new SwitchHeroBoardTabFeature();
      await tabs.switchTo('inventory');
      await this.map.inventory.useEquippedItem(await this.itemId(this.tokenId));
      await tabs.switchTo('battle');
      await this.map.battleTab.hoverBoardPoint(point);
      await this.map.battleTab.verifyToolHexOffers(/Attack|Атакувати/);
      await this.map.battleTab.pressToolHexAction();
      await this.crit.verifyStrike(critical, damage);
      await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.settleInventorySync());
      await this.map.reload();
      await this.map.activeBoard.waitForReady();
      await this.crit.verifySavedHealth(30 - damage);
    });
  }

  async replaceWithPlainWeapon(): Promise<void> {
    await this.step('Replace the same-type critical weapon with a plain token', async () => {
      await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.giveHeroTheTurn(20));
      await this.equip(this.replacement);
      await new SwitchHeroBoardTabFeature().switchTo('battle');
    });
  }

  private async equip(tokenId: string): Promise<void> {
    this.tokenId = tokenId;
    const tabs = new SwitchHeroBoardTabFeature();
    await tabs.switchTo('inventory');
    await this.map.inventory.dragTokenToEquipSlot(await this.itemId(tokenId), EquipSlot.WEAPON);
    await tabs.switchTo('hero');
  }

  private async itemId(tokenId: string): Promise<string> {
    const id = await this.page.evaluate(
      (token) => window.__HEXOFLAT_TEST__!.getInventoryItemIdByTokenId(token),
      tokenId,
    );
    if (!id) throw new Error('No critical weapon token');
    return id;
  }
}
