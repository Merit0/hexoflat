import { expect } from '@playwright/test';
import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { BattleFlowFeature } from '@features/world/battle-flow.feature';
import type { CollectGrave, CollectItem } from '@components/battle-collect.component';

/**
 * What the player does after a won battle: walk to a grave, look through it with the hand (the eye),
 * pick up what lies around it and leave. The win itself is granted by the fixture hook.
 */
export class BattleCollectFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();
  private readonly collect = this.campingMap.battleCollect;
  private expected: Record<string, number> = {};
  private looted: CollectItem[] = [];

  async winTheBattle(): Promise<void> {
    await this.step('Start a battle against a squad and win it', async () => {
      await new BattleFlowFeature().startBattleNextToTheSquad();
      await this.campingMap.hexBoard.finishBattle('victory');
      await this.collect.waitForCollecting();
      await this.collect.waitForBoardStill();
    });
  }

  async verifyTheBoardStaysOpenWithGraves(): Promise<void> {
    await this.step('Verify the board stays open and every fallen enemy left a grave', async () => {
      await this.campingMap.battleTab.verifyBoardOpen();
      const snapshot = await this.collect.read();
      expect(snapshot.graves.length).toBeGreaterThan(0);
      expect(snapshot.graves.every((grave) => !grave.examined)).toBe(true);
    });
  }

  async lookThroughEveryGrave(): Promise<void> {
    await this.step('Walk to every grave and look through it with the hand', async () => {
      const graves = (await this.collect.read()).graves;
      for (const grave of graves) await this.lookThrough(grave);
    });
  }

  private async lookThrough(grave: CollectGrave): Promise<void> {
    const before = await this.collect.read();
    const stand = await this.collect.clickFirstUncoveredHex(grave.standHexes);
    await this.collect.verifyHeroStandsAt(stand);
    await this.collect.waitForBoardStill();
    await this.collect.openTheHandTool();
    await this.collect.hoverHex(grave);
    await this.collect.verifyToolOffers(/^(Read|Читати)$/);
    await this.collect.pressToolAction();
    await this.collect.verifyExamined(grave, true);
    await this.collect.waitForBoardStill();
    const after = await this.collect.read();
    const fresh = after.items.filter(
      (item) => !before.items.some((old) => old.q === item.q && old.r === item.r),
    );
    for (const item of fresh)
      this.expected[item.itemKey] = (this.expected[item.itemKey] ?? 0) + item.amount;
    this.looted.push(...fresh);
  }

  async pickUpEverythingLyingAround(): Promise<void> {
    await this.step('Pick up every item lying on the field with the hand', async () => {
      for (const item of (await this.collect.read()).items) {
        const stand = await this.collect.clickFirstUncoveredHex(item.standHexes);
        await this.collect.verifyHeroStandsAt(stand);
        await this.collect.waitForBoardStill();
        await this.collect.openTheHandTool();
        await this.collect.hoverHex(item);
        await this.collect.pressToolAction();
        await this.collect.verifyItemGone(item);
        await this.collect.waitForBoardStill();
      }
    });
  }

  async verifyTheBagHoldsTheLoot(): Promise<void> {
    await this.step('Verify the bag holds everything that was picked up', async () => {
      await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.settleInventorySync());
      const totals = await this.collect.bagTotals();
      for (const [key, amount] of Object.entries(this.expected)) {
        expect(totals[key] ?? 0, `bag holds ${key}`).toBeGreaterThanOrEqual(amount);
      }
    });
  }

  async verifyEveryGraveIsExaminedAndNothingLiesAround(): Promise<void> {
    await this.step('Verify every grave is examined and no loot is left', async () => {
      const snapshot = await this.collect.read();
      expect(snapshot.graves.every((grave) => grave.examined)).toBe(true);
      expect(snapshot.items).toEqual([]);
      expect(snapshot.lootLeft).toBe(false);
    });
  }

  async leaveTheBattle(): Promise<void> {
    await this.step('Press LEAVE BATTLE', () => this.collect.pressLeave());
  }

  async verifyTheBoardIsBack(): Promise<void> {
    await this.step('Verify the battle closed and the squad token is gone', async () => {
      await this.campingMap.battleTab.verifyBoardClosed();
      await expect.poll(() => this.campingMap.hexBoard.isBattleEngaged()).toBe(false);
    });
  }

  async verifyLeavingAsksOnceWhileLootRemains(): Promise<void> {
    await this.step('Leaving with loot left asks once; cancel stays, confirm leaves', async () => {
      await this.collect.pressLeave();
      await this.collect.verifyLeaveWarningShown(true);
      await this.collect.cancelLeave();
      await this.collect.verifyLeaveWarningShown(false);
      await this.campingMap.battleTab.verifyBoardOpen();
      await this.collect.pressLeave();
      await this.collect.confirmLeave();
      await this.verifyTheBoardIsBack();
    });
  }

  async reloadAndVerifyTheCollectionPhaseIsBack(): Promise<void> {
    await this.step('Reload the page and verify the collection phase resumes', async () => {
      const before = await this.collect.read();
      await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.settleInventorySync());
      await this.page.reload();
      await this.campingMap.hexBoard.waitForReady();
      await this.collect.waitForCollecting();
      const after = await this.collect.read();
      expect(after.graves.map((g) => [g.q, g.r, g.examined])).toEqual(
        before.graves.map((g) => [g.q, g.r, g.examined]),
      );
      expect(after.items).toEqual(before.items);
    });
  }
}
