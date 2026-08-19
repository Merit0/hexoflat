import { expect } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';

/** The full-width hero stats/session-controls header (apps/web's hero-board-header.vue). */
export class TopbarComponent extends BaseComponent {
  private get root() {
    return this.page.getByTestId('topbar');
  }

  private get mapChip() {
    return this.page.getByTestId('topbar-map-chip');
  }

  private get hpValue() {
    return this.page.getByTestId('topbar-hp-value');
  }

  private get stepsChip() {
    return this.page.getByTestId('topbar-steps-chip');
  }

  private get settingsButton() {
    return this.page.getByTestId('topbar-settings-button');
  }

  private get logoutButton() {
    return this.page.getByTestId('topbar-logout-button');
  }

  async readStepsText(): Promise<string> {
    return this.stepsChip.innerText();
  }

  async openSettings(): Promise<void> {
    await this.settingsButton.click();
  }

  /**
   * dispatchEvent, not click(): the adjacent game-events-logger panel
   * visually overlaps the logout button at this viewport size and would
   * absorb a real mouse click at that screen position (a pre-existing topbar
   * layering quirk, unrelated to what the logout tests verify). Dispatching
   * the DOM event on the button sidesteps hit-testing entirely.
   */
  async logout(): Promise<void> {
    await this.logoutButton.dispatchEvent('click');
  }

  async verifyIsVisible(): Promise<void> {
    await expect(this.root).toBeVisible();
  }

  async verifyMapChipContains(text: string): Promise<void> {
    await expect(this.mapChip).toContainText(text);
  }

  async verifyHeroHealth(value: string): Promise<void> {
    await expect(this.hpValue).toHaveText(value);
  }

  async verifyStepsTextChangedFrom(previous: string): Promise<void> {
    await expect(this.stepsChip).not.toHaveText(previous);
  }
}
