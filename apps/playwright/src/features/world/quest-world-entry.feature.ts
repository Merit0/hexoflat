import { expect } from '@playwright/test';
import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { QuestEntranceComponent } from '@components/quest-entrance.component';
import { QuestBoardFeature } from './quest-board.feature';
import type { QuestFieldSnapshot, QuestHex } from '@components/quest-field.component';

export class QuestWorldEntryFeature extends BaseFeature {
  private readonly map = new CampingMapPage();
  private readonly entrance = new QuestEntranceComponent();
  private readonly board = new QuestBoardFeature();
  private marker: QuestHex | null = null;

  async accept() {
    await this.step(
      'Accept Treasure Seeker into My Quests without entering the quest map',
      async () => {
        if (!(await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getOpenQuestBoard())))
          await this.board.open();
        const active = await this.page.evaluate(() =>
          window
            .__HEXOFLAT_TEST__!.getQuests()
            .active.some((entry) => entry.questId === 'seeker-1'),
        );
        if (!active) await this.map.questBoard.start('seeker-1');
        await this.map.questBoard.verifyCardState('seeker-1', 'taken');
        await this.entrance.verifyFieldClosed();
        await this.map.questBoard.close();
      },
    );
  }

  async enterFromSilesia(preserveQuestWill = false) {
    await this.step(
      'Travel to Silesia, walk next to the treasure map and OPEN it with the hand',
      async () => {
        const questWill = await this.map.questBoard.readWill();
        await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.prepareKnowledgeWorld(50));
        await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.settleInventorySync());
        await this.page.goto('/world/silesia');
        await this.map.hexBoard.waitForReady();
        const { marker, route } = await this.entrance.approachRoute();
        if (this.marker) expect(marker).toEqual(this.marker);
        this.marker = marker;
        for (const hex of route) {
          await this.map.hexBoard.clickTile(hex);
          await this.map.hexBoard.verifyHeroSettledAt(hex);
        }
        if (preserveQuestWill) {
          await this.page.evaluate((will) => window.__HEXOFLAT_TEST__!.setWill(will), questWill);
          await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.settleInventorySync());
        }
        await this.map.hexBoard.armHandTool();
        await this.map.hexBoard.hoverTile(marker);
        await this.map.toolActionOverlay.verifyOfferedAction(/Open|Відкрити/i);
        await this.map.toolActionOverlay.triggerAction();
        await this.map.questField.waitForReady();
        await this.entrance.verifyQuestUrl();
        await this.entrance.verifyQuestTabs();
      },
    );
  }

  async walkTrailAndReloadBeforeReturningToPortal() {
    await this.step(
      'Walk the first numbered step, reload with progress, then walk back to the portal',
      async () => {
        const field = this.map.questField;
        const before = await field.read();
        const target = before.hexes.find(
          (cell) => cell.step && !cell.step.back && cell.number === 1,
        );
        if (!target) throw new Error('No first numbered trail step is offered');
        await field.clickHex(target.hex);
        await field.verifyPathLength(1);
        const advanced = await field.read();
        expect(advanced.position).toEqual(target.hex);
        expect(advanced.position).not.toEqual(before.position);
        await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.settleInventorySync());
        await this.page.reload();
        await field.waitForReady();
        await this.entrance.verifyQuestUrl();
        await this.verifySameRun(advanced);
        await this.entrance.verifyQuestTabs();
        const back = (await field.read()).hexes.find((cell) => cell.step?.back);
        if (!back) throw new Error('No step back to the camping portal is offered');
        await field.clickHex(back.hex);
        await field.verifyPathLength(0);
        expect((await field.read()).position).toEqual(before.position);
      },
    );
  }

  async reloadAtCamp() {
    await this.step('Reload at camp while the Treasure Seeker run is suspended', async () => {
      await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.settleInventorySync());
      await this.page.reload();
      await this.map.hexBoard.waitForReady();
      await this.entrance.verifyFieldClosed();
      await this.map.hexBoard.verifyLocation('camping');
    });
  }

  async pauseThroughPortal() {
    return this.step(
      'Enter the adjacent camping portal with the hand and preserve the run',
      async () => {
        const before = await this.map.questField.read();
        const portal = await this.entrance.exitPoint();
        await this.map.questField.armHand();
        await this.map.questField.aimHandAt(portal);
        await this.map.questField.pressToolHex();
        await this.entrance.verifyFieldClosed();
        await this.map.hexBoard.verifyLocation('camping');
        const active = await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getQuests());
        expect(active.active.some((entry) => entry.questId === 'seeker-1')).toBe(true);
        return before;
      },
    );
  }

  async verifySameRun(before: QuestFieldSnapshot) {
    await this.step('Verify re-entry preserves the quest field and position', async () => {
      const after = await this.map.questField.read();
      expect(after).toEqual(before);
    });
  }
}
