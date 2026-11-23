import { BaseFeature } from '@framework/base-feature';
import { expect } from '@playwright/test';
import type { TestQuestBoard, TestQuestOffer } from '@web-test-api';
import { CampingMapPage } from '@pages/camping-map.page';
import { MoveHeroFeature } from '@features/world/move-hero.feature';
import { ReloadCampingMapFeature } from '@features/world/reload-camping-map.feature';
import { UseHeroToolFeature } from '@features/world/use-hero-tool.feature';
import { Tool } from '@config/hero-tool';
import { tokenCoordinates } from '@config/test-data';
import type { QuestFixture, QuestFixtureEntry } from '@components/quest-board.component';

export type { QuestFixture, QuestFixtureEntry };

/** Opening the quest board (a real walk, then the hand's Read action) and playing the quests on it. */
export class QuestBoardFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  private get board() {
    return this.campingMap.questBoard;
  }

  async open(): Promise<void> {
    await this.step('Walk to the quest board and read it with the hand tool', async () => {
      await new MoveHeroFeature().moveAdjacentTo('questBoard');
      await new UseHeroToolFeature(Tool.HAND).use();
      await this.campingMap.hexBoard.hoverTile(tokenCoordinates('questBoard'));
      await this.campingMap.toolActionOverlay.triggerAction();
      await this.board.verifyIsOpen();
    });
  }

  async reloadAndOpenAgain(): Promise<void> {
    await this.step('Reload the camp, then read the board again', async () => {
      await new ReloadCampingMapFeature().reload();
      await this.board.verifyIsClosed();
      await this.open();
    });
  }

  async accept(questId: string): Promise<void> {
    await this.step(`Accept "${questId}"`, () => this.board.accept(questId));
  }

  async offer(templateId: string): Promise<TestQuestOffer> {
    return this.step(`Read the issued offer for "${templateId}"`, async () => {
      const { offers } = await this.board.readBoard();
      const log = await this.board.readLog();
      const matches = offers.filter((offer) => offer.templateId === templateId);
      const offer =
        matches.find(({ id }) => log.active.some(({ questId }) => questId === id)) ?? matches[0];
      if (!offer)
        throw new Error(
          `No offer for ${templateId} in ${offers.map((row) => row.templateId).join(', ')}`,
        );
      return offer;
    });
  }

  async snapshot(): Promise<TestQuestBoard> {
    return this.step('Read the server quest board snapshot', () => this.board.readBoard());
  }

  async verifyTemplateAbsent(templateId: string): Promise<void> {
    await this.step(`Verify "${templateId}" has no issued offer`, async () => {
      const { offers } = await this.board.readBoard();
      expect(offers.some((offer) => offer.templateId === templateId)).toBe(false);
    });
  }

  async setProgress(offer: TestQuestOffer, progress: number, ready = false): Promise<void> {
    await this.step(`Set progress for the accepted offer "${offer.templateId}"`, async () => {
      await this.board.verifyCardState(offer.id, 'taken');
      const log = await this.board.readLog();
      expect(log.active.some(({ questId }) => questId === offer.id)).toBe(true);
      const active = log.active.map((entry) =>
        entry.questId === offer.id
          ? { questId: offer.id, progress, state: ready ? ('ready' as const) : ('active' as const) }
          : entry,
      );
      await this.board.givenQuests({ active });
    });
  }

  async refresh(): Promise<void> {
    await this.step('Click the paid refresh in the board header', () => this.board.refresh());
  }

  async verifyRefreshPrice(price: number): Promise<void> {
    await this.step(`Verify refresh is quoted at ${price} Will`, () =>
      this.board.verifyRefreshPrice(price),
    );
  }

  async verifySameBoard(before: TestQuestBoard): Promise<void> {
    await this.step('Verify every offer and the quote are preserved', () =>
      this.board.verifyBoard(before),
    );
  }

  async verifyRotation(
    before: TestQuestBoard,
    kept: string,
    price: number,
    dayId = before.dayId,
  ): Promise<void> {
    await this.step(`Verify rotation keeps the active offer and shows ${price} Will`, () =>
      this.board.verifyReplacement(before, kept, dayId, price),
    );
  }

  async verifyRefill(before: TestQuestBoard, retired: string): Promise<void> {
    await this.step('Verify the completed offer is replaced once', () =>
      this.board.verifyRefill(before, retired),
    );
  }

  async dragToActive(questId: string): Promise<void> {
    await this.step('Drag the card into My Quests', () => this.board.dragToActive(questId));
  }

  async switchToTouchLayout(): Promise<void> {
    await this.step('Resize to the touch viewport', () =>
      this.page.setViewportSize({ width: 375, height: 812 }),
    );
  }

  async verifyLayout(): Promise<void> {
    await this.step('Verify the group order and the header action placement', () =>
      this.board.verifyBoardLayout(),
    );
  }

  async tapToInspectAndAccept(questId: string): Promise<void> {
    await this.step('Tap the row to inspect it, then tap its Take action', async () => {
      await this.board.tapRow(questId);
      await this.board.tapAccept(questId);
      await this.board.verifyCardState(questId, 'taken');
    });
  }

  async verifyReward(offer: TestQuestOffer): Promise<void> {
    await this.step(`Verify the claimed reward for "${offer.templateId}"`, async () => {
      for (const reward of offer.rewards) {
        if (reward.kind === 'will') continue;
        await this.board.verifyBagAmount(reward.itemKey, reward.amount);
        if (reward.token) await this.board.verifyRewardToken(reward.token.id);
      }
    });
  }

  async claim(questId: string): Promise<void> {
    await this.step(`Claim the reward of "${questId}"`, () => this.board.claim(questId));
  }

  async givenQuests(fixture: QuestFixture): Promise<void> {
    await this.step('Arrange the hero quest log', () => this.board.givenQuests(fixture));
  }

  async verifyCardState(questId: string, state: 'open' | 'taken'): Promise<void> {
    await this.step(`Verify the "${questId}" card is ${state}`, () =>
      this.board.verifyCardState(questId, state),
    );
  }

  async verifyCardNotOnBoard(questId: string): Promise<void> {
    await this.step(`Verify "${questId}" is no longer on the board`, () =>
      this.board.verifyCardNotOnBoard(questId),
    );
  }

  async verifyProgress(questId: string, text: string): Promise<void> {
    await this.step(`Verify "${questId}" progress is ${text}`, () =>
      this.board.verifyProgress(questId, text),
    );
  }

  async verifyReady(questId: string, ready: boolean): Promise<void> {
    await this.step(`Verify "${questId}" ready is ${ready}`, () =>
      this.board.verifyReady(questId, ready),
    );
  }

  async verifyNotTracked(questId: string): Promise<void> {
    await this.step(`Verify "${questId}" is not in MY QUESTS`, () =>
      this.board.verifyNotTracked(questId),
    );
  }

  async verifyWarning(pattern: RegExp): Promise<void> {
    await this.step('Verify the general warning banner explains the refusal', () =>
      this.campingMap.actionAlertBanner.verifyIsVisibleMatching(pattern),
    );
  }

  async verifyRefusal(pattern: RegExp): Promise<void> {
    await this.step('Verify the board explains the refusal', () =>
      this.board.verifyMessage(pattern),
    );
  }

  async verifySlots(used: number, max: number): Promise<void> {
    await this.step(`Verify ${used} of ${max} quest slots are used`, () =>
      this.board.verifySlots(used, max),
    );
  }

  async verifyWill(will: number): Promise<void> {
    await this.step(`Verify the hero has ${will} Will`, () => this.board.verifyWill(will));
  }

  async verifyBagAmount(itemKey: string, amount: number): Promise<void> {
    await this.step(`Verify the bag holds ${amount} x ${itemKey}`, () =>
      this.board.verifyBagAmount(itemKey, amount),
    );
  }

  async verifyDoneCount(questId: string, times: number): Promise<void> {
    await this.step(`Verify "${questId}" was completed ${times} time(s)`, () =>
      this.board.verifyDoneCount(questId, times),
    );
  }

  async verifyIsClosed(): Promise<void> {
    await this.step('Verify the quest board is closed', () => this.board.verifyIsClosed());
  }

  async close(): Promise<void> {
    await this.step('Close the quest board', () => this.board.close());
  }

  async verifyRule(questId: string, phrases: string[]): Promise<void> {
    await this.step(`Verify the rule of "${questId}" says ${phrases.join(', ')}`, () =>
      this.board.verifyRule(questId, phrases),
    );
  }

  async verifyCardText(questId: string, pattern: RegExp): Promise<void> {
    await this.step(`Verify the "${questId}" card says ${pattern}`, () =>
      this.board.verifyCardText(questId, pattern),
    );
  }

  async verifyCardTextAbsent(questId: string, pattern: RegExp): Promise<void> {
    await this.step(`Verify the "${questId}" card never says ${pattern}`, () =>
      this.board.verifyCardTextAbsent(questId, pattern),
    );
  }

  async verifyNoStartButton(questId: string): Promise<void> {
    await this.step(`Verify "${questId}" has no start button`, () =>
      this.board.verifyNoStartButton(questId),
    );
  }

  async verifyStartDisabled(questId: string, disabled: boolean): Promise<void> {
    await this.step(`Verify START of "${questId}" is ${disabled ? 'disabled' : 'enabled'}`, () =>
      this.board.verifyStartDisabled(questId, disabled),
    );
  }

  async verifyShortOfWillReason(questId: string, shown: boolean): Promise<void> {
    await this.step(
      `Verify the short-of-Will reason of "${questId}" is ${shown ? 'shown' : 'hidden'}`,
      () => this.board.verifyShortOfWillReason(questId, shown),
    );
  }
}
