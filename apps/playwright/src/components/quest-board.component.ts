import { expect, type Locator } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';

const POLL = { timeout: 5_000, intervals: [100] };

export type QuestFixtureEntry = { questId: string; progress: number; state: 'active' | 'ready' };
export type QuestFixture = { active?: QuestFixtureEntry[]; done?: Record<string, number> };

/**
 * The quest board that replaces the hero panel after OPEN (the eye) with the hand on the board
 * hex (apps/web's quest-board.vue), plus the QUESTS tab mark. Stored state is read, and quests
 * are arranged, through the app's test hooks.
 */
export class QuestBoardComponent extends BaseComponent {
  private get board(): Locator {
    return this.page.getByTestId('quest-board');
  }

  private card(questId: string): Locator {
    return this.page.getByTestId(`quest-card-${questId}`);
  }

  async verifyIsOpen(): Promise<void> {
    await expect(this.board).toBeVisible();
    await expect
      .poll(() => this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getOpenQuestBoard()), POLL)
      .toBe(true);
  }

  async verifyIsClosed(): Promise<void> {
    await expect(this.board).toBeHidden();
  }

  async close(): Promise<void> {
    await this.page.getByTestId('quest-board-close').click();
  }

  async accept(questId: string): Promise<void> {
    await this.page.getByTestId(`quest-accept-${questId}`).click();
  }

  async claim(questId: string): Promise<void> {
    await this.page.getByTestId(`quest-claim-${questId}`).click();
  }

  async abandon(questId: string): Promise<void> {
    await this.page.getByTestId(`quest-abandon-${questId}`).click();
  }

  async verifyReadyMarkOnTab(shown: boolean): Promise<void> {
    await expect(this.page.getByTestId('quests-tab-mark')).toHaveCount(shown ? 1 : 0);
  }

  async verifyCardOnBoard(questId: string): Promise<void> {
    await expect(this.card(questId)).toBeVisible();
  }

  async verifyCardNotOnBoard(questId: string): Promise<void> {
    await expect(this.card(questId)).toHaveCount(0);
  }

  async verifyCardState(questId: string, state: 'open' | 'taken' | 'locked'): Promise<void> {
    await expect(this.card(questId)).toHaveAttribute('data-state', state);
  }

  async verifyProgress(questId: string, text: string): Promise<void> {
    await expect(this.page.getByTestId(`quest-progress-${questId}`)).toHaveText(text);
  }

  async verifyReady(questId: string, ready: boolean): Promise<void> {
    await expect(this.page.getByTestId(`quest-tracked-${questId}`)).toHaveAttribute(
      'data-ready',
      String(ready),
    );
    await expect(this.page.getByTestId(`quest-claim-${questId}`)).toHaveCount(ready ? 1 : 0);
  }

  async verifyNotTracked(questId: string): Promise<void> {
    await expect(this.page.getByTestId(`quest-tracked-${questId}`)).toHaveCount(0);
  }

  async verifyMessage(pattern: RegExp): Promise<void> {
    await expect(this.page.getByTestId('quest-message')).toHaveText(pattern);
  }

  async verifySlots(used: number, max: number): Promise<void> {
    await expect(this.page.getByTestId('quest-slots')).toContainText(`${used} / ${max}`);
  }

  async givenQuests(fixture: QuestFixture): Promise<void> {
    await this.page.evaluate((f) => window.__HEXOFLAT_TEST__!.setQuests(f), fixture);
  }

  async verifyActiveOnServerState(expected: QuestFixtureEntry[]): Promise<void> {
    await expect
      .poll(() => this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getQuests().active), POLL)
      .toEqual(expected);
  }

  async verifyDoneCount(questId: string, times: number): Promise<void> {
    await expect
      .poll(
        () =>
          this.page.evaluate((id) => window.__HEXOFLAT_TEST__!.getQuests().done[id] ?? 0, questId),
        POLL,
      )
      .toBe(times);
  }

  async verifyWill(will: number): Promise<void> {
    await expect
      .poll(() => this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getKnowledge()?.current), POLL)
      .toBe(will);
  }

  async verifyBagAmount(itemKey: string, amount: number): Promise<void> {
    await expect
      .poll(
        () =>
          this.page.evaluate(
            (key) =>
              window
                .__HEXOFLAT_TEST__!.getBag()
                .filter((cell) => cell?.key === key)
                .reduce((sum, cell) => sum + (cell?.amount ?? 0), 0),
            itemKey,
          ),
        POLL,
      )
      .toBe(amount);
  }
}
