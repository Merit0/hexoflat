import { expect } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';
import '@framework/test-api';

export class EquipmentYieldComponent extends BaseComponent {
  async verifyResources(
    resource: 'tree' | 'rock',
    amount: number,
    questId: string,
    progress: number,
  ): Promise<void> {
    await expect
      .poll(
        () =>
          this.page.evaluate(
            ({ resource }) => {
              const state = window.__HEXOFLAT_TEST__!.getHarvest();
              return {
                gathered: state.counts[resource] ?? 0,
                counted: resource === 'tree' ? state.wood : state.stone,
              };
            },
            { resource },
          ),
        { timeout: 20_000 },
      )
      .toEqual({ gathered: amount, counted: amount });
    await expect
      .poll(() =>
        this.page.evaluate(
          (id) =>
            window.__HEXOFLAT_TEST__!.getQuests().active.find((quest) => quest.questId === id)
              ?.progress,
          questId,
        ),
      )
      .toBe(progress);
  }

  async verifyPending(bonus: number): Promise<void> {
    await expect
      .poll(() => this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getHarvest().pending))
      .toEqual([expect.objectContaining({ bonus })]);
  }
}
