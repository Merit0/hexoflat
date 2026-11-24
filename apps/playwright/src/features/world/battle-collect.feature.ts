import { SwitchHeroBoardTabFeature } from './switch-hero-board-tab.feature';
import { UseEquippedToolFeature } from './use-equipped-tool.feature';
import { expect } from '@playwright/test';
import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { BattleFlowFeature } from '@features/world/battle-flow.feature';
import type { CollectGrave, CollectItem } from '@components/battle-collect.component';

const GRAVE_FLIGHT_START_MS = 2_000;

export interface ExpectedUnique {
  uniqueKey: string;
  tokenType: string;
  light: RegExp;
}

/**
 * What the player does after a won battle: walk to a grave, look through it with the hand (the eye),
 * pick up what lies around it and leave. The win itself is granted by the fixture hook.
 */
export class BattleCollectFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();
  private readonly collect = this.campingMap.battleCollect;
  private expected: Record<string, number> = {};
  private looted: CollectItem[] = [];

  async winTheBattle(squad?: string): Promise<void> {
    await this.step('Start a battle against a squad and win it', async () => {
      await new BattleFlowFeature().startBattleNextToTheSquad({ squad });
      await this.campingMap.hexBoard.finishBattle('victory');
      await this.collect.waitForCollecting();
      await this.collect.waitForBoardStill();
    });
  }

  async winTheBattleWithForcedUniqueDrops(squad: string): Promise<void> {
    await this.step('Force the unique rolls of the boss and win the battle', async () => {
      await new BattleFlowFeature().startBattleNextToTheSquad({ squad });
      await this.collect.forceUniqueDrops();
      await this.campingMap.hexBoard.finishBattle('victory');
      await this.collect.waitForCollecting();
      await this.collect.waitForBoardStill();
      expect(await this.collect.uniqueItems()).toEqual([]);
    });
  }

  async findTheUniquesAndVerifyTheirLight(expected: ExpectedUnique[]): Promise<void> {
    await this.step('Read the graves until the uniques lie on the field', async () => {
      const graves = (await this.collect.read()).graves.sort(
        (a, b) => b.standHexes.length - a.standHexes.length,
      );
      for (const grave of graves) {
        await this.lookThrough(grave);
        if ((await this.collect.uniqueItems()).length > 0) break;
      }
      await this.verifyUniquesOnTheField(expected);
    });
  }

  async verifyNoMoreUniquesAfterEveryGrave(expected: ExpectedUnique[]): Promise<void> {
    await this.step('Read the other graves and verify no more uniques appear', async () => {
      for (const grave of (await this.collect.read()).graves)
        if (!grave.examined) await this.lookThrough(grave);
      await this.verifyUniquesOnTheField(expected);
    });
  }

  private async verifyUniquesOnTheField(expected: ExpectedUnique[]): Promise<void> {
    const found = await this.collect.uniqueItems();
    expect(found).toHaveLength(expected.length);
    for (const { light, ...unique } of expected) {
      const item = found.find(({ uniqueKey }) => uniqueKey === unique.uniqueKey);
      expect(item).toMatchObject({ ...unique, tier: 'unique' });
      expect(item!.light).toMatch(light);
    }
  }

  async pickUpTheUniqueAndVerifyTheBag(uniqueKey: string): Promise<void> {
    await this.step(`Pick "${uniqueKey}" up with the hand and find it in the bag`, async () => {
      const unique = (await this.collect.uniqueItems()).find(
        (entry) => entry.uniqueKey === uniqueKey,
      )!;
      const item = (await this.collect.read()).items.find(
        ({ q, r }) => q === unique.q && r === unique.r,
      )!;
      await this.pickUp(item);
      await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.settleInventorySync());
      await this.collect.verifyOwned(unique);
    });
  }

  async verifyToolActivationAfterVictory(via: 'wheel' | 'inventory'): Promise<void> {
    await this.step(
      `Activate the hero tool through ${via} after all enemies are dead and read a grave`,
      async () => {
        const battle = await this.campingMap.hexBoard.readBattleSnapshot();
        const enemies = battle!.creatures.filter((creature) => creature.side === 'enemies');
        expect(enemies.length).toBeGreaterThan(0);
        expect(enemies.every((creature) => creature.hp === 0)).toBe(true);
        const grave = (await this.collect.read()).graves[0];
        const stand = await this.collect.clickFirstUncoveredHex(grave.standHexes);
        await this.collect.verifyHeroStandsAt(stand);
        await this.collect.waitForBoardStill();
        await this.collect.verifyToolHidden();
        if (via === 'wheel') await this.collect.openTheHandTool();
        else {
          const tabs = new SwitchHeroBoardTabFeature();
          await tabs.switchTo('inventory');
          await new UseEquippedToolFeature().use('hand');
          await tabs.switchTo('battle');
        }
        await this.collect.verifyToolVisible();
        await this.collect.hoverHex(grave);
        await this.collect.verifyToolOffers(/^(Read|Читати)$/);
        await this.collect.pressToolAction();
        await this.collect.verifyExamined(grave, true);
      },
    );
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

  async lookThroughGravesAndLeaveWhileTheLootFlies(): Promise<void> {
    await this.step(
      'Look through graves and leave the battle while a grave loot flies',
      async () => {
        for (const grave of (await this.collect.read()).graves) {
          const stand = await this.collect.clickFirstUncoveredHex(grave.standHexes);
          await this.collect.verifyHeroStandsAt(stand);
          await this.collect.waitForBoardStill();
          await this.collect.openTheHandTool();
          await this.collect.hoverHex(grave);
          await this.collect.pressToolAction();
          if (await this.campingMap.lootBoard.lootStartsFlying(GRAVE_FLIGHT_START_MS)) {
            await this.collect.pressLeave();
            await this.collect.confirmLeave();
            await this.verifyTheBoardIsBack();
            return;
          }
          await this.collect.verifyExamined(grave, true);
          await this.collect.waitForBoardStill();
        }
        throw new Error('No grave gave any loot to fly');
      },
    );
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
      for (const item of (await this.collect.read()).items) await this.pickUp(item);
    });
  }

  private async pickUp(item: CollectItem): Promise<void> {
    const stand = await this.collect.clickFirstUncoveredHex(item.standHexes);
    await this.collect.verifyHeroStandsAt(stand);
    await this.collect.waitForBoardStill();
    await this.collect.openTheHandTool();
    await this.collect.hoverHex(item);
    await this.collect.pressToolAction();
    await this.collect.verifyItemGone(item);
    await this.collect.waitForBoardStill();
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
      await this.campingMap.reload();
      await this.campingMap.activeBoard.waitForReady();
      await this.collect.waitForCollecting();
      const after = await this.collect.read();
      expect(after.graves.map((g) => [g.q, g.r, g.examined])).toEqual(
        before.graves.map((g) => [g.q, g.r, g.examined]),
      );
      expect(after.items).toEqual(before.items);
    });
  }
}
