import { expect } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';
import type { TestHexCoordinates } from '@framework/test-api';
import '@framework/test-api';

export class EquipmentSmartStepComponent extends BaseComponent {
  async verifyProgress(current: number, paidSteps: number): Promise<void> {
    await expect
      .poll(() =>
        this.page.evaluate(() => ({
          current: window.__HEXOFLAT_TEST__!.getKnowledge()?.current,
          paidSteps: window.__HEXOFLAT_TEST__!.getPaidSteps(),
        })),
      )
      .toEqual({ current, paidSteps });
    await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.settleInventorySync());
  }

  async nextStep(): Promise<TestHexCoordinates> {
    const target = await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.findWorldStep());
    if (!target) throw new Error('No visible empty world step');
    return target;
  }

  async verifyPosition(at: TestHexCoordinates): Promise<void> {
    await expect
      .poll(() => this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getHeroCoordinates()))
      .toEqual(at);
  }
}
