import { expect, type Locator } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';

/** The Events tab's log list (apps/web's game-events-logger.vue). */
export class EventsLogComponent extends BaseComponent {
  private get root(): Locator {
    return this.page.getByTestId('events-logger');
  }

  private get clearButton(): Locator {
    return this.page.getByTestId('events-logger-clear-button');
  }

  private get scrollBox(): Locator {
    return this.page.getByTestId('events-tab-content');
  }

  private get rows(): Locator {
    return this.page.getByTestId(/^events-logger-row-/);
  }

  async clickClear(): Promise<void> {
    await this.clearButton.click();
  }

  async verifyIsVisible(): Promise<void> {
    await expect(this.root).toBeVisible();
  }

  async verifyClearButtonVisible(): Promise<void> {
    await expect(this.clearButton).toBeVisible();
  }

  async verifyHasRowMatching(text: RegExp): Promise<void> {
    await expect(this.rows.filter({ hasText: text }).first()).toBeVisible();
  }

  async verifyRowCount(count: number): Promise<void> {
    await expect(this.rows).toHaveCount(count);
  }

  async fillWithTestEvents(count: number): Promise<void> {
    await this.page.evaluate((n) => window.__HEXOFLAT_TEST__!.logTestEvents(n), count);
    await expect(this.rows).toHaveCount(count);
  }

  async scrollWithTheWheel(): Promise<void> {
    await this.scrollBox.hover();
    await this.page.mouse.wheel(0, 300);
  }

  async verifyScrolledToTop(): Promise<void> {
    await expect.poll(() => this.scrollBox.evaluate((box) => box.scrollTop)).toBe(0);
  }

  async verifyScrolledDown(): Promise<void> {
    await expect.poll(() => this.scrollBox.evaluate((box) => box.scrollTop)).toBeGreaterThan(0);
  }
}
