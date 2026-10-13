import { expect, test } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';
import '@framework/test-api';

export class KnowledgeBoardComponent extends BaseComponent {
  async verifyMobileQuestion(): Promise<void> {
    await this.page.setViewportSize({ width: 390, height: 844 });
    const option = this.page.getByTestId('knowledge-answer-3');
    await expect(option).toBeInViewport();
    await this.page.screenshot({ path: test.info().outputPath('knowledge-mobile.png') });
    await this.answer(true, true);
    await this.page.setViewportSize({ width: 1280, height: 720 });
  }
  async captureDesktop(): Promise<void> {
    await this.page.screenshot({ path: test.info().outputPath('knowledge-desktop.png') });
  }
  private async capacity(): Promise<number> {
    return (await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getKnowledgeRules())).capacity;
  }
  async verifyStartingWill(): Promise<void> {
    const rules = await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getKnowledgeRules());
    await this.verifyWill(rules.startingWill);
    await expect(this.page.getByTestId('knowledge-start')).toBeEnabled();
  }
  async verifyReturnOffered(): Promise<void> {
    await expect(this.page.getByTestId('knowledge-return-offer')).toBeVisible();
  }
  async verifyFull(): Promise<void> {
    await expect(this.page.getByTestId('knowledge-start')).toBeDisabled();
    await expect(this.page.getByTestId('knowledge-will')).toContainText(
      `${await this.capacity()}/`,
    );
    await expect(this.page.locator('#knowledge-entry-message')).toContainText(
      /Твоя воля|Your Will/,
    );
  }
  async close(): Promise<void> {
    await this.page
      .getByTestId('knowledge-board')
      .getByRole('button', { name: /Close and save|Закрити та/ })
      .click();
  }
  async start(): Promise<void> {
    await this.page.getByTestId('knowledge-start').click();
    await expect(this.page.getByTestId('knowledge-question')).toBeVisible();
  }
  async offerReturn(): Promise<void> {
    await this.page.getByTestId('knowledge-return-offer').click();
  }
  async answer(correct: boolean, keyboard = false): Promise<void> {
    const state = await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getKnowledge());
    if (!state) throw new Error('No challenge');
    const index = state.options.findIndex((answer) =>
      correct ? answer === state.answer : answer !== state.answer,
    );
    const option = this.page.getByTestId(`knowledge-answer-${index}`);
    if (keyboard) {
      await option.focus();
      await option.press('Enter');
    } else await option.click();
    await expect
      .poll(() => this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getKnowledge()?.status))
      .toBe(state.index === 19 ? 'result' : 'question');
    if (state.index < 19) await this.verifyQuestionIndex(state.index + 1);
  }
  async verifyResult(percent: number): Promise<void> {
    await expect(this.page.getByTestId('knowledge-result')).toContainText(`${percent}%`);
  }
  async claim(current: number): Promise<void> {
    await this.page.getByTestId('knowledge-claim').click();
    await expect(this.page.getByTestId('knowledge-will')).toContainText(
      `${current}/${await this.capacity()}`,
    );
  }
  async returnHome(): Promise<void> {
    await this.page.getByTestId('knowledge-return').click();
    await expect(this.page).toHaveURL(/\/world\/camping/);
    await expect
      .poll(() => this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getKnowledge()?.status))
      .toBe('returned');
  }
  async verifyWill(current: number): Promise<void> {
    await expect
      .poll(() => this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getKnowledge()?.current))
      .toBe(current);
  }
  async verifyQuestionIndex(index: number): Promise<void> {
    await expect
      .poll(() => this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getKnowledge()?.index))
      .toBe(index);
  }
  async pressEscape(): Promise<void> {
    await this.page.keyboard.press('Escape');
  }
  async verifyClosed(): Promise<void> {
    await expect(this.page.getByTestId('knowledge-board')).toBeHidden();
  }
  async verifyOpen(): Promise<void> {
    await expect(this.page.getByTestId('knowledge-board')).toBeVisible();
  }
  async pickCorrectAnswerAndVerifyAccepted(): Promise<void> {
    const state = await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getKnowledge());
    if (!state) throw new Error('No challenge');
    await this.page.getByTestId(`knowledge-answer-${state.options.indexOf(state.answer!)}`).click();
    await this.verifyQuestionIndex(state.index + 1);
    await this.verifyAnswerAccepted();
  }
  async verifyAnswerAccepted(): Promise<void> {
    await expect(this.page.getByText(/Action not completed|Дію не виконано/)).toBeHidden();
  }
  async verifyCorrectAnswerShownAfterMistake(): Promise<void> {
    const state = await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getKnowledge());
    if (!state) throw new Error('No challenge');
    const wrong = state.options.findIndex((answer) => answer !== state.answer);
    await this.page.getByTestId(`knowledge-answer-${wrong}`).click();
    const right = this.page.getByTestId(`knowledge-answer-${state.options.indexOf(state.answer!)}`);
    await expect(right).toHaveClass(/is-correct/);
    await expect(this.page.getByTestId('knowledge-next')).toHaveCount(0);
    await this.verifyQuestionIndex(state.index + 1);
  }
}
