import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { OpenCampingMapFeature } from './open-camping-map.feature';
import { TakeTokenFeature } from './take-token.feature';
import { DragInventoryItemFeature } from './drag-inventory-item.feature';
import { SwitchHeroBoardTabFeature } from './switch-hero-board-tab.feature';
import { UseEquippedToolFeature } from './use-equipped-tool.feature';
import { UseHeroToolFeature } from './use-hero-tool.feature';
import { VerifyInventoryFeature } from './verify-inventory.feature';
import { tokenCoordinates, HexobjectKeys } from '@config/test-data';
import { EquipSlot } from '@config/equip-slot';
import { Tool } from '@config/hero-tool';
import '@framework/test-api';

const WILL_FOR_THE_TRIP = 40;
const SCROLL_PRICE = 5;
const CAVE_PRICE = 2;

export class VerifyReturnPortalFeature extends BaseFeature {
  private readonly map = new CampingMapPage();

  private async fetchScrollFromCamp(): Promise<void> {
    await new OpenCampingMapFeature().open();
    await new TakeTokenFeature('returnScroll').take();
    await new VerifyInventoryFeature().verifyContainsItem(HexobjectKeys.returnScroll);
  }

  private async goToSilesia(): Promise<void> {
    await this.page.evaluate(
      (current) => window.__HEXOFLAT_TEST__!.prepareKnowledgeWorld(current),
      WILL_FOR_THE_TRIP,
    );
    await this.page.goto('/world/silesia');
    await this.map.hexBoard.waitForReady();
  }

  private async scrollCount(): Promise<number> {
    return this.page.evaluate(
      (key) => window.__HEXOFLAT_TEST__!.getInventoryItemAmount(key),
      HexobjectKeys.returnScroll,
    );
  }

  private async currentWill(): Promise<number> {
    const state = await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getKnowledge());
    if (!state) throw new Error('No Will state');
    return state.current;
  }

  private async openPortalWithScroll(): Promise<{
    target: { columnIndex: number; rowIndex: number };
    oneWay: boolean;
  }> {
    await new SwitchHeroBoardTabFeature().switchTo('inventory');
    await new DragInventoryItemFeature().dragToEquipSlot(
      HexobjectKeys.returnScroll,
      EquipSlot.WEAPON,
    );
    await new UseEquippedToolFeature().use(HexobjectKeys.returnScroll);
    const { target, oneWay } = await this.map.hexBoard.hoverPortalTarget();
    await this.map.toolActionOverlay.triggerAction();
    return { target, oneWay };
  }

  private async enterAdjacentPortal(): Promise<void> {
    await new UseHeroToolFeature(Tool.HAND).use();
    await this.map.hexBoard.hoverNeighborWithKey(HexobjectKeys.returnPortal);
    await this.map.toolActionOverlay.triggerAction();
  }

  private async openPortalInSilesiaAndEnterCamp(): Promise<{
    target: { columnIndex: number; rowIndex: number };
    willBefore: number;
  }> {
    await this.fetchScrollFromCamp();
    await this.goToSilesia();
    const willBefore = await this.currentWill();
    const scrollsBefore = await this.scrollCount();
    const { target } = await this.openPortalWithScroll();

    await this.map.knowledge.verifyWill(willBefore - SCROLL_PRICE);
    await new VerifyInventoryFeature().verifyItemAmount(HexobjectKeys.returnScroll, scrollsBefore);
    await this.map.hexBoard.verifyTileHoldsHexobject(target, HexobjectKeys.returnPortal);

    await this.enterAdjacentPortal();
    await this.map.verifyUrlMatches(/\/world\/camping/);
    await this.map.hexBoard.waitForReady();
    await this.map.hexBoard.verifyLocation('camping');
    await this.map.knowledge.verifyWill(willBefore - SCROLL_PRICE);
    return { target, willBefore };
  }

  async verifyRoundTripThroughThePortals(): Promise<void> {
    await this.step(
      'A scroll opens a portal to the camp and the same pair leads back',
      async () => {
        const { target } = await this.openPortalInSilesiaAndEnterCamp();

        const campPortal = await this.map.hexBoard.requireSingleTileWithKey(
          HexobjectKeys.returnPortal,
        );
        await this.map.hexBoard.verifyHeroBesideTile(campPortal);

        await this.enterAdjacentPortal();
        await this.map.verifyUrlMatches(/\/world\/silesia/);
        await this.map.hexBoard.waitForReady();
        await this.map.hexBoard.verifyLocation('silesia');
        await this.map.hexBoard.verifyHeroBesideTile(target);
        await this.map.hexBoard.verifyTileCountWithKey(HexobjectKeys.returnPortal, 0);

        await this.page.goto('/world/camping');
        await this.map.hexBoard.waitForReady();
        await this.map.hexBoard.verifyTileCountWithKey(HexobjectKeys.returnPortal, 0);
      },
    );
  }

  async verifyLeavingByTheGateClosesThePair(): Promise<void> {
    await this.step('Leaving the camp by its own gate removes both portals', async () => {
      await this.openPortalInSilesiaAndEnterCamp();

      await this.map.hexBoard.moveAdjacentTo(tokenCoordinates('homelandGate'));
      await new UseHeroToolFeature(Tool.HAND).use();
      await this.map.hexBoard.hoverTile(tokenCoordinates('homelandGate'));
      await this.map.toolActionOverlay.triggerAction();

      await this.map.verifyUrlMatches(/\/world\/silesia/);
      await this.map.hexBoard.waitForReady();
      await this.map.hexBoard.verifyTileCountWithKey(HexobjectKeys.returnPortal, 0);

      await this.page.goto('/world/camping');
      await this.map.hexBoard.waitForReady();
      await this.map.hexBoard.verifyTileCountWithKey(HexobjectKeys.returnPortal, 0);
    });
  }

  async verifyCavePortalLeadsOneWay(): Promise<void> {
    await this.step('A portal opened in the cave is one-way: the camp gets no portal', async () => {
      await this.fetchScrollFromCamp();
      await this.goToSilesia();

      const entrance = tokenCoordinates('caveEntrance');
      await this.map.hexBoard.moveAdjacentTo(entrance);
      const willBeforeCave = await this.currentWill();
      await new UseHeroToolFeature(Tool.HAND).use();
      await this.map.hexBoard.hoverTile(entrance);
      await this.map.toolActionOverlay.triggerAction();
      await this.map.verifyUrlMatches(/\/world\/cave/);
      await this.map.hexBoard.waitForReady();
      await this.map.knowledge.verifyWill(willBeforeCave - CAVE_PRICE);

      const { oneWay } = await this.openPortalWithScroll();
      if (!oneWay) throw new Error('A cave portal must be announced as one-way.');
      await this.map.knowledge.verifyWill(willBeforeCave - CAVE_PRICE - SCROLL_PRICE);

      await this.enterAdjacentPortal();
      await this.map.verifyUrlMatches(/\/world\/camping/);
      await this.map.hexBoard.waitForReady();
      await this.map.hexBoard.verifyLocation('camping');
      await this.map.hexBoard.verifyTileCountWithKey(HexobjectKeys.returnPortal, 0);
    });
  }
}
