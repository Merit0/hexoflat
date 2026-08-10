import { expect } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';

/** The settings overlay (apps/web's settings-overlay.vue). */
export class SettingsOverlayComponent extends BaseComponent {
  private get closeButton() {
    return this.page.getByTestId('settings-close-button');
  }

  private get localeSelect() {
    return this.page.getByTestId('settings-locale-select');
  }

  async close(): Promise<void> {
    await this.closeButton.click();
  }

  async verifyIsOpen(): Promise<void> {
    await expect(this.closeButton).toBeVisible();
  }

  /**
   * The close button is one of the few fully-localized strings in the app,
   * which makes its rendered text the cheapest proof that the ICU pipeline
   * actually resolved the active locale at runtime.
   */
  async verifyCloseButtonLabel(label: string): Promise<void> {
    await expect(this.closeButton).toHaveText(label);
  }

  async verifyLocaleSelectValue(locale: string): Promise<void> {
    await expect(this.localeSelect).toHaveValue(locale);
  }
}
