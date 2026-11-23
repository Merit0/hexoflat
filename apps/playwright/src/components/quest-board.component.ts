import { expect, type Locator } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';
import type { TestQuestBoard, TestQuestFixture, TestQuests } from '@web-test-api';

const POLL = { timeout: 5_000, intervals: [100] };

export type QuestFixtureEntry = TestQuests['active'][number];
export type QuestFixture = TestQuestFixture;

/**
 * The quest board that replaces the hero panel after OPEN (the eye) with the hand on the board
 * hex (apps/web's quest-board.vue). Stored state is read, and quests
 * are arranged, through the app's test hooks.
 */
export class QuestBoardComponent extends BaseComponent {
  private get board(): Locator {
    return this.page.getByTestId('quest-board');
  }

  private card(questId: string): Locator {
    return this.page.getByTestId(`quest-card-${questId}`);
  }

  private get refreshButton(): Locator {
    return this.board.getByTestId('quest-board-refresh');
  }

  async readBoard(): Promise<TestQuestBoard> {
    const read = () => this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getQuestBoard());
    await expect.poll(read, POLL).not.toBeNull();
    const board = await read();
    if (!board) throw new Error('The server has not issued a quest board');
    return board;
  }

  async readLog(): Promise<TestQuests> {
    return this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getQuests());
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

  async refresh(): Promise<void> {
    await this.refreshButton.click();
  }

  async verifyRefreshPrice(price: number): Promise<void> {
    await expect(this.refreshButton).toHaveAccessibleName(new RegExp(`\\b${price}\\b`));
  }

  async verifyBoard(expected: TestQuestBoard): Promise<void> {
    await expect.poll(() => this.readBoard(), POLL).toEqual(expected);
  }

  async verifyReplacement(
    before: TestQuestBoard,
    retained: string,
    dayId: number,
    price: number,
  ): Promise<void> {
    await expect
      .poll(async () => {
        const board = await this.readBoard();
        return { dayId: board.dayId, price: board.refreshPrice, count: board.offers.length };
      }, POLL)
      .toEqual({ dayId, price, count: before.offers.length });
    const after = await this.readBoard();
    expect(after.offers).toHaveLength(before.offers.length);
    expect(after.offers.find(({ id }) => id === retained)).toEqual(
      before.offers.find(({ id }) => id === retained),
    );
    const previousIds = new Set(before.offers.map(({ id }) => id));
    expect(after.offers.filter(({ id }) => previousIds.has(id)).map(({ id }) => id)).toEqual([
      retained,
    ]);
  }

  async verifyRefill(before: TestQuestBoard, retired: string) {
    const retained = before.offers.filter(({ id }) => id !== retired);
    await expect
      .poll(async () => {
        const { offers } = await this.readBoard();
        return {
          count: offers.length,
          retired: offers.some(({ id }) => id === retired),
          retained: offers.filter(({ id }) => retained.some((offer) => offer.id === id)),
        };
      }, POLL)
      .toEqual({ count: before.offers.length, retired: false, retained });
  }

  async dragToActive(questId: string): Promise<void> {
    await this.page
      .getByTestId(`quest-row-${questId}`)
      .dragTo(this.board.getByTestId('quest-group-active'));
  }

  async tapRow(questId: string): Promise<void> {
    await this.page.getByTestId(`quest-row-${questId}`).tap();
    await expect(this.page.getByTestId(`quest-details-${questId}`)).toBeVisible();
  }

  async verifyBoardLayout(): Promise<void> {
    const active = this.board.getByTestId('quest-group-active');
    const available = this.board.getByTestId('quest-group-available');
    const header = this.board.locator('header');
    await expect(header.getByTestId('quest-board-refresh')).toBeVisible();
    const [title, refresh, close, first, second] = await Promise.all([
      header.getByRole('heading').boundingBox(),
      this.refreshButton.boundingBox(),
      header.getByTestId('quest-board-close').boundingBox(),
      active.boundingBox(),
      available.boundingBox(),
    ]);
    if (!title || !refresh || !close || !first || !second)
      throw new Error('The quest board layout is incomplete');
    expect(title.x + title.width).toBeLessThanOrEqual(refresh.x);
    expect(refresh.x + refresh.width).toBeLessThanOrEqual(close.x);
    expect(first.y + first.height).toBeLessThanOrEqual(second.y);
  }

  async tapAccept(questId: string): Promise<void> {
    await this.page.getByTestId(`quest-accept-${questId}`).tap();
  }

  async claim(questId: string): Promise<void> {
    await this.page.getByTestId(`quest-claim-${questId}`).click();
  }

  async abandon(questId: string): Promise<void> {
    await this.page.getByTestId(`quest-row-${questId}`).hover();
    await this.page.getByTestId(`quest-abandon-${questId}`).click();
  }

  async verifyCardOnBoard(questId: string): Promise<void> {
    await expect(this.card(questId)).toBeVisible();
  }

  async verifyCardNotOnBoard(questId: string): Promise<void> {
    await expect(this.card(questId)).toHaveCount(0);
  }

  async verifyCardState(questId: string, state: 'open' | 'taken'): Promise<void> {
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

  async verifyRewardToken(tokenId: string): Promise<void> {
    await expect
      .poll(
        () =>
          this.page.evaluate((id) => window.__HEXOFLAT_TEST__!.getInventoryToken(id)?.id, tokenId),
        POLL,
      )
      .toBe(tokenId);
  }

  async start(questId: string): Promise<void> {
    await this.page.getByTestId(`quest-start-${questId}`).click();
  }

  async verifyStartDisabled(questId: string, disabled: boolean): Promise<void> {
    const button = this.page.getByTestId(`quest-start-${questId}`);
    if (disabled) await expect(button).toBeDisabled();
    else await expect(button).toBeEnabled();
  }

  async verifyShortOfWillReason(questId: string, shown: boolean): Promise<void> {
    if (shown) await this.page.getByTestId(`quest-row-${questId}`).hover();
    await expect(this.page.getByTestId(`quest-short-${questId}`)).toHaveCount(shown ? 1 : 0);
  }

  async verifyNoStartButton(questId: string): Promise<void> {
    await expect(this.page.getByTestId(`quest-start-${questId}`)).toHaveCount(0);
  }

  async verifyCardText(questId: string, pattern: RegExp): Promise<void> {
    await expect(this.card(questId)).toContainText(pattern);
  }

  async verifyCardTextAbsent(questId: string, pattern: RegExp): Promise<void> {
    await expect(this.card(questId)).not.toContainText(pattern);
  }

  async verifyRule(questId: string, phrases: string[]): Promise<void> {
    await this.page.getByTestId(`quest-row-${questId}`).hover();
    const rule = this.page.getByTestId(`quest-details-${questId}-rule`);
    for (const phrase of phrases) await expect(rule).toContainText(phrase);
  }

  async verifyRunCard(): Promise<void> {
    await expect(this.page.getByTestId('quest-run-card')).toBeVisible();
  }

  async verifyRunStep(text: RegExp): Promise<void> {
    await expect(this.page.getByTestId('quest-run-step')).toHaveText(text);
  }

  async verifyTrail(numbers: number[]): Promise<void> {
    const row = this.page.getByTestId('quest-trail-row');
    if (!numbers.length) {
      await expect(row.getByTestId('quest-trail-empty')).toBeVisible();
      return;
    }
    await expect(row.getByTestId('quest-trail-chip')).toHaveText(numbers.map(String));
  }

  async verifyRunPhase(phase: string): Promise<void> {
    await expect(this.page.getByTestId('quest-run-card')).toHaveAttribute('data-phase', phase);
  }

  async returnToCamp(): Promise<void> {
    await this.page.getByTestId('quest-return-to-camp').click();
  }

  async giveUp(): Promise<void> {
    await this.page.getByTestId('quest-give-up').click();
    await this.page.getByTestId('quest-give-up-confirm').click();
  }

  async verifyLostCard(): Promise<void> {
    await expect(this.page.getByTestId('quest-run-lost')).toBeVisible();
    await expect(this.page.getByTestId('quest-run-lost-hint')).toBeVisible();
    await expect(this.page.getByTestId('quest-leave-map')).toBeVisible();
    await expect(this.page.getByTestId('quest-return-to-camp')).toHaveCount(0);
  }

  async leaveMap(): Promise<void> {
    await this.page.getByTestId('quest-leave-map').click();
  }

  async readWill(): Promise<number> {
    const will = await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getKnowledge()?.current);
    if (will === undefined) throw new Error('No Will to read');
    return will;
  }

  async verifyResult(outcome: string): Promise<void> {
    await expect(this.page.getByTestId('quest-result')).toHaveAttribute('data-outcome', outcome);
  }

  async dismissResult(): Promise<void> {
    await this.page.getByTestId('quest-result-dismiss').click();
  }

  async verifyRunGone(): Promise<void> {
    await expect(this.page.getByTestId('quest-run-card')).toHaveCount(0);
  }
}
