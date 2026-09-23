import { expect } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';

const AUTO_HIDE_TIMEOUT_MS = 5_000;

/**
 * The bottom-of-map alert for a rejected hex action (apps/web's
 * action-alert-banner.vue), shared by every tool action — not just OPEN.
 */
export class ActionAlertBannerComponent extends BaseComponent {
  private get banner() {
    return this.page.getByTestId('action-alert-banner');
  }

  async verifyIsVisibleWithText(expected: string): Promise<void> {
    await expect(this.banner).toBeVisible();
    await expect(this.banner).toContainText(expected);
  }

  /** The banner clears itself a few seconds after showing — no manual dismiss exists. */
  async verifyAutoHides(): Promise<void> {
    await expect(this.banner).toBeHidden({ timeout: AUTO_HIDE_TIMEOUT_MS });
  }
}
