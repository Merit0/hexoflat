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

  async verifyRowCount(count: number): Promise<void> {
    await expect(this.rows).toHaveCount(count);
  }
}
