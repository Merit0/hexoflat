import { expect } from '@playwright/test';
import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import {
  QuestEntranceComponent,
  type ClonedFieldSource,
} from '@components/quest-entrance.component';
import { QuestBoardFeature } from './quest-board.feature';
import type { QuestFieldSnapshot, QuestHex } from '@components/quest-field.component';

export class QuestWorldEntryFeature extends BaseFeature {
  private readonly map = new CampingMapPage();
  private readonly entrance = new QuestEntranceComponent();
  private readonly board = new QuestBoardFeature();
  private marker: QuestHex | null = null;
  private source: ClonedFieldSource | null = null;
  private offerId: string | null = null;

  async accept() {
    return this.step(
      'Accept Treasure Seeker into My Quests without entering the quest map',
      async () => {
        if (!(await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getOpenQuestBoard())))
          await this.board.open();
        const offer = await this.board.offer('seeker-1');
        this.offerId = offer.id;
        const active = await this.page.evaluate(
          (id) =>
            window.__HEXOFLAT_TEST__!.getQuests().active.some((entry) => entry.questId === id),
          offer.id,
        );
        if (!active) await this.map.questBoard.start(offer.id);
        await this.map.questBoard.verifyCardState(offer.id, 'taken');
        await this.entrance.verifyFieldClosed();
        await this.map.activeBoard.verifyOnly('world');
        await this.map.questBoard.close();
        return offer;
      },
    );
  }

  async enterFromSilesia({ preserveQuestWill = false, approachWithPointer = true } = {}) {
    await this.step(
      'Travel to Silesia, walk next to the treasure map and OPEN it with the hand',
      async () => {
        const questWill = await this.map.questBoard.readWill();
        await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.prepareKnowledgeWorld(50));
        await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.settleInventorySync());
        await this.page.goto('/world/silesia');
        await this.map.hexBoard.waitForReady();
        await this.map.activeBoard.verifyOnly('world');
        const { marker, route } = await this.entrance.approachRoute();
        if (this.marker) expect(marker).toEqual(this.marker);
        this.marker = marker;
        if (approachWithPointer) await this.walkViaPointer(route);
        else
          await this.page.evaluate(
            (path) => window.__HEXOFLAT_TEST__!.followQuestApproach(path),
            route,
          );
        await this.map.activeBoard.verifyHeroTokenSettled();
        if (preserveQuestWill) {
          await this.page.evaluate((will) => window.__HEXOFLAT_TEST__!.setWill(will), questWill);
          await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.settleInventorySync());
        }
        const source = await this.entrance.readFieldSource(marker);
        await this.map.hexBoard.armHandTool();
        await this.map.hexBoard.hoverTile(marker);
        await this.map.toolActionOverlay.verifyOfferedAction(/Open|Відкрити/i);
        const worldHexSpacing = await this.entrance.readWorldHexSpacing();
        await this.map.toolActionOverlay.triggerAction();
        await this.map.questField.waitForReady();
        await this.map.activeBoard.verifyOnly('quest');
        await this.entrance.verifyQuestHexSpacing(worldHexSpacing);
        await this.entrance.verifyQuestUrl();
        await this.entrance.verifyQuestTabs();
        if (!this.source) {
          this.source = source;
          await this.entrance.verifyClonedField(source);
        }
      },
    );
  }

  private async walkViaPointer(route: QuestHex[]): Promise<void> {
    for (const hex of route) {
      await this.map.hexBoard.clickTile(hex);
      await this.map.hexBoard.verifyHeroSettledAt(hex);
    }
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
        await this.map.activeBoard.verifyOnly('quest');
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

  async verifyOnlyDoorAndHero() {
    await this.step(
      'Verify only the camping door and the hero stand on the cloned field',
      async () => {
        const field = await this.map.questField.read();
        const door = await this.entrance.exitPoint();
        const free = await this.entrance.freeNeighbour();
        await this.map.questField.putTheHandDown();
        await this.map.questField.hoverHex(field.position);
        await this.entrance.verifyNoObjectTooltip();
        await this.map.questField.hoverHex(free);
        await this.entrance.verifyNoObjectTooltip();
        await this.map.questField.hoverHex(door);
        await this.entrance.verifyDoorTooltip();
        await this.map.questField.armHand();
        await this.map.questField.aimHandAt(free);
        await this.entrance.verifyNoActionOffered();
        await this.map.questField.putTheHandDown();
      },
    );
  }

  async verifyInventoryHandUsesQuestPosition() {
    await this.step(
      'Activate Hand from its Inventory cell and USE button beside the quest hero',
      async () => {
        await this.map.heroBoardPanel.clickTab('inventory');
        const hand = await this.map.inventory.getItemIdByKey('hand');
        await this.map.inventory.clickEquippedItem(hand);
        await this.entrance.verifyToolBesideQuestHero();
        await this.map.questField.putTheHandDown();
        await this.map.inventory.useEquippedItem(hand);
        await this.entrance.verifyToolBesideQuestHero();
        await this.map.questField.aimHandAt(await this.entrance.freeNeighbour());
        await this.map.questField.putTheHandDown();
        await this.map.heroBoardPanel.clickTab('quest');
      },
    );
  }

  async reloadAtCamp() {
    await this.step('Reload at camp while the Treasure Seeker run is suspended', async () => {
      await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.settleInventorySync());
      await this.page.reload();
      await this.map.hexBoard.waitForReady();
      await this.map.activeBoard.verifyOnly('world');
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
        await this.map.activeBoard.verifyOnly('world');
        const active = await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getQuests());
        expect(active.active.some((entry) => entry.questId === this.offerId)).toBe(true);
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
