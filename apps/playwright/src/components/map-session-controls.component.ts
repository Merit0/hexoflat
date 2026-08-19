import { expect, type Locator } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';

/** The Settings/Logout icon buttons in the map pane's top-right corner (apps/web's hex-world-map.vue). */
export class MapSessionControlsComponent extends BaseComponent {
  private get settingsButton(): Locator {
    return this.page.getByTestId('topbar-settings-button');
  }

  private get logoutButton(): Locator {
    return this.page.getByTestId('topbar-logout-button');
  }

  async clickSettings(): Promise<void> {
    await this.settingsButton.click();
  }

  async clickLogout(): Promise<void> {
    await this.logoutButton.click();
  }

  async verifySettingsButtonVisible(): Promise<void> {
    await expect(this.settingsButton).toBeVisible();
  }

  async verifyLogoutButtonVisible(): Promise<void> {
    await expect(this.logoutButton).toBeVisible();
  }
}
