import { BaseFeature } from '@framework/base-feature';
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

  async claim(questId: string): Promise<void> {
    await this.step(`Claim the reward of "${questId}"`, () => this.board.claim(questId));
  }

  async givenQuests(fixture: QuestFixture): Promise<void> {
    await this.step('Arrange the hero quest log', () => this.board.givenQuests(fixture));
  }

  async verifyCardState(questId: string, state: 'open' | 'taken' | 'locked'): Promise<void> {
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
}
