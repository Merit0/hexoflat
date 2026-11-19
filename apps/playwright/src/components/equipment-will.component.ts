import { expect } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';
import '@framework/test-api';

export class EquipmentWillComponent extends BaseComponent {
  async verifyWill(current: number, capacity: number): Promise<void> {
    await expect
      .poll(async () => {
        const state = await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getKnowledge());
        return state ? { current: state.current, capacity: state.capacity } : null;
      })
      .toEqual({ current, capacity });
    await expect(this.page.getByTestId('hero-will-value')).toHaveText(
      new RegExp(`^\\s*${current}\\s*/\\s*${capacity}\\s*$`),
    );
    await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.settleInventorySync());
  }
}
