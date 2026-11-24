import { expect } from '@playwright/test';
import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import type { TestItemToken, TestTokenSpec } from '@framework/test-api';
import { EquipSlot } from '@config/equip-slot';
import { Tool } from '@config/hero-tool';
import { tokenCoordinates } from '@config/test-data';
import { OpenCampingMapFeature } from './open-camping-map.feature';
import { UseHeroToolFeature } from './use-hero-tool.feature';
import { OpenShopFeature } from './open-shop.feature';
import { ShopBoardFeature } from './shop-board.feature';

export class DimensionItemsFeature extends BaseFeature {
  private readonly map = new CampingMapPage();
  private readonly items = this.map.dimensionItems;
  private token: TestItemToken | null = null;

  async startWithBase(tokenType: TestTokenSpec['tokenType']): Promise<void> {
    await this.step(`Start with a factory-authored ${tokenType} sword`, async () => {
      await new OpenCampingMapFeature().open();
      this.token = await this.page.evaluate(
        (tokenType) =>
          window.__HEXOFLAT_TEST__!.grantTokenItem({
            type: 'sword',
            tokenType,
            mapTier: 3,
          }),
        tokenType,
      );
    });
  }

  async startWithAlien(): Promise<void> {
    await this.step('Start with the manually authored ALIEN Last Verdict unique', async () => {
      await new OpenCampingMapFeature().open();
      this.token = await this.page.evaluate(() =>
        window.__HEXOFLAT_TEST__!.grantUniqueTokenItem('last-verdict'),
      );
      expect(this.requireToken()).toMatchObject({
        dimension: 'nowhere',
        tokenType: 'alien',
        uniqueKey: 'last-verdict',
        skills: ['b_strike'],
      });
    });
  }

  async equipAndVerify(label: RegExp): Promise<void> {
    await this.step('Equip the exact token and verify its ownership in the tooltip', async () => {
      await this.map.heroBoardPanel.clickTab('inventory');
      const id = await this.itemId();
      await this.map.inventory.dragTokenToEquipSlot(id, EquipSlot.WEAPON);
      await this.map.inventory.verifyItemEquipped(id, EquipSlot.WEAPON);
      await this.map.inventory.hoverEquippedItem(id);
      await this.items.verifyTooltipDimension(label);
      await this.map.inventory.moveMouseAway();
      await this.items.verifyTokenUnchanged(this.requireToken());
    });
  }

  async travelToUnderworldAndReload(label: RegExp): Promise<void> {
    await this.step(
      'Carry the equipped token through the Earth and Underworld gates, then reload',
      async () => {
        await this.enterGate('homelandGate');
        await this.map.verifyUrlMatches(/\/world\/silesia$/);
        await this.map.activeBoard.waitForReady();
        await this.map.hexBoard.verifyLocation('silesia');
        await this.enterGate('caveEntrance');
        await this.map.verifyUrlMatches(/\/world\/cave$/);
        await this.map.activeBoard.waitForReady();
        await this.reloadCurrentMap();
        await this.map.hexBoard.verifyLocation('cave');
        await this.map.heroBoardPanel.clickTab('inventory');
        const id = await this.itemId();
        await this.map.inventory.verifyItemEquipped(id, EquipSlot.WEAPON);
        await this.map.inventory.hoverEquippedItem(id);
        await this.items.verifyTooltipDimension(label);
        await this.map.inventory.moveMouseAway();
        await this.items.verifyTokenUnchanged(this.requireToken());
      },
    );
  }

  async sellBuybackAndReload(label: RegExp): Promise<void> {
    await this.step(
      'Sell the token, reload the trader, buy it back and preserve its identity',
      async () => {
        await new OpenShopFeature().open();
        const shop = new ShopBoardFeature();
        await shop.sellByRightClick('sword');
        await this.verifyHeldByTrader();
        await new OpenShopFeature().openAfterReload();
        await this.verifyHeldByTrader();
        if (this.isUnique()) await this.map.shopBoard.buyBackUnique(0);
        else await shop.buyBackByRightClick(0);
        await new OpenShopFeature().close();
        await this.reloadCurrentMap();
        await this.map.heroBoardPanel.clickTab('inventory');
        const id = await this.itemId();
        await this.map.inventory.hoverGridItem(id);
        await this.items.verifyTooltipDimension(label);
        await this.items.verifyTokenUnchanged(this.requireToken());
      },
    );
  }

  private isUnique(): boolean {
    return this.requireToken().tier === 'unique';
  }

  private async verifyHeldByTrader(): Promise<void> {
    const token = this.requireToken();
    if (this.isUnique()) await this.map.shopBoard.verifyUniqueBuybackHolds(token);
    else await this.items.verifyBuybackToken(token);
  }

  private async enterGate(name: 'homelandGate' | 'caveEntrance'): Promise<void> {
    const at = tokenCoordinates(name);
    await this.map.inventory.moveMouseAway();
    await this.map.hexBoard.moveAdjacentTo(at);
    await new UseHeroToolFeature(Tool.HAND).use();
    await this.map.hexBoard.hoverTile(at);
    await this.map.toolActionOverlay.triggerAction();
  }

  private async reloadCurrentMap(): Promise<void> {
    await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.settleInventorySync());
    await this.map.reload();
    await this.map.activeBoard.waitForReady();
  }

  private async itemId(): Promise<string> {
    const id = await this.page.evaluate(
      (tokenId) => window.__HEXOFLAT_TEST__!.getInventoryItemIdByTokenId(tokenId),
      this.requireToken().id,
    );
    if (!id) throw new Error('The owned token is missing');
    return id;
  }

  private requireToken(): TestItemToken {
    if (!this.token) throw new Error('No token arranged');
    return this.token;
  }
}
