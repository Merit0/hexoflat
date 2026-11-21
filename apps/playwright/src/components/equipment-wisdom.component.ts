import { expect } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';
import '@framework/test-api';

export class EquipmentWisdomComponent extends BaseComponent {
  async answerHallAndVerify(min: number, max = min): Promise<void> {
    const before = await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getKnowledge());
    if (!before) throw new Error('No Hall question');
    const index = before.options.indexOf(before.answer!);
    await this.page.getByTestId(`knowledge-answer-${index}`).click();
    await expect
      .poll(async () => {
        const next = await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getKnowledge());
        return next && next.current - before.current;
      })
      .toBeGreaterThanOrEqual(min);
    const after = await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getKnowledge());
    expect(after!.current - before.current).toBeLessThanOrEqual(max);
    expect(after!.lastAward).toBe(after!.current - before.current);
    await expect
      .poll(() => this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getKnowledge()?.status))
      .not.toBe('feedback');
  }

  async answerBattle(option: number): Promise<void> {
    await this.page.getByTestId(`battle-task-option-${option}`).click();
    await expect(this.page.getByTestId('battle-task')).toBeHidden();
  }

  async verifyWill(current: number): Promise<void> {
    await expect
      .poll(() => this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getKnowledge()?.current))
      .toBe(current);
    await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.settleInventorySync());
  }
}
