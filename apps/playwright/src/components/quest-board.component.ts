import { expect, type Locator } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';

const POLL = { timeout: 5_000, intervals: [100] };

export type QuestFixtureEntry = { questId: string; progress: number; state: 'active' | 'ready' };
export type QuestFixture = { active?: QuestFixtureEntry[]; done?: Record<string, number> };

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
    await this.page.getByTestId(`quest-row-${questId}`).click();
    await this.page.getByTestId(`quest-abandon-${questId}`).click();
  }

  async verifyCardOnBoard(questId: string): Promise<void> {
    await expect(this.card(questId)).toBeVisible();
  }

  async verifyCardNotOnBoard(questId: string): Promise<void> {
    await expect(this.card(questId)).toHaveCount(0);
  }

  private async expandLocked(): Promise<void> {
    const toggle = this.page.getByTestId('quest-group-locked-toggle');
    if ((await toggle.count()) === 0) return;
    if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
  }

  async verifyCardState(questId: string, state: 'open' | 'taken' | 'locked'): Promise<void> {
    if (state === 'locked') await this.expandLocked();
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
    await this.expandLocked();
    await expect(this.page.getByTestId(`quest-start-${questId}`)).toHaveCount(0);
  }

  async verifyCardText(questId: string, pattern: RegExp): Promise<void> {
    await this.expandLocked();
    await expect(this.card(questId)).toContainText(pattern);
  }

  async verifyCardTextAbsent(questId: string, pattern: RegExp): Promise<void> {
    await expect(this.card(questId)).not.toContainText(pattern);
  }

  async verifyChips(questId: string, chips: string[]): Promise<void> {
    await this.page.getByTestId(`quest-row-${questId}`).hover();
    const row = this.page.getByTestId(`quest-chips-${questId}`);
    for (const chip of chips) await expect(row).toContainText(chip);
  }

  async verifyRunCard(): Promise<void> {
    await expect(this.page.getByTestId('quest-run-card')).toBeVisible();
  }

  async verifyRunStep(text: RegExp): Promise<void> {
    await expect(this.page.getByTestId('quest-run-step')).toHaveText(text);
  }

  async verifyTrail(numbers: number[]): Promise<void> {
    const expected = numbers.length ? numbers.join(' · ') : '—';
    await expect(this.page.getByTestId('quest-trail-row')).toContainText(expected);
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
