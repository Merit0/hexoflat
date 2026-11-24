import { expect } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';
import type { TestItemToken } from '@framework/test-api';

export class DimensionItemsComponent extends BaseComponent {
  async verifyTokenUnchanged(token: TestItemToken): Promise<void> {
    await expect
      .poll(() =>
        this.page.evaluate((id) => window.__HEXOFLAT_TEST__!.getInventoryToken(id), token.id),
      )
      .toEqual(token);
  }

  async verifyTooltipDimension(label: RegExp): Promise<void> {
    await expect(this.page.getByTestId('item-tooltip').getByText(label)).toBeVisible();
  }

  async verifyBuybackToken(token: TestItemToken): Promise<void> {
    await expect
      .poll(() =>
        this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getTrader('ilva')?.buyback[0]?.token),
      )
      .toEqual(token);
  }
}
