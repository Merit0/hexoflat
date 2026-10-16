import { expect, type Locator } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';
import type { TestHeroHealth } from '@framework/test-api';

export type HeroBoardTab = 'hero' | 'inventory' | 'skills' | 'events';
export type HeroDetailsTab = 'state' | 'path';

/**
 * The persistent right-side panel — collapse rail, the Hero/Inventory/
 * Skills/Events tab strip, and the Hero tab's own stat readouts (apps/web's
 * hero-board-panel.vue). Inventory-tab drag/drop lives in its own
 * HeroInventoryComponent; this owns the panel chrome around it.
 */
export class HeroBoardPanelComponent extends BaseComponent {
  private get panel(): Locator {
    return this.page.getByTestId('hero-board-panel');
  }

  private get toggleRail(): Locator {
    return this.page.getByTestId('hero-board-toggle');
  }

  private tab(tab: HeroBoardTab): Locator {
    return this.page.getByTestId(`hero-board-tab-${tab}`);
  }

  private get heroName(): Locator {
    return this.page.getByTestId('topbar-hero-name');
  }

  private get handsSection(): Locator {
    return this.page.getByTestId('hero-details-state');
  }

  private detailsTab(tab: HeroDetailsTab): Locator {
    return this.page.getByTestId(`hero-details-tab-${tab}`);
  }

  private get shieldsVitals(): Locator {
    return this.page.getByTestId('hero-vitals-shields');
  }

  private get willVitals(): Locator {
    return this.page.getByTestId('hero-vitals-will');
  }

  private get scoutPathCard(): Locator {
    return this.page.getByTestId('hero-path-scout');
  }

  private get healthBar(): Locator {
    return this.page.getByTestId('topbar-hp-bar');
  }

  private get stepsText(): Locator {
    return this.page.getByTestId('hero-path-steps');
  }

  private get scoutChip(): Locator {
    return this.page.getByTestId('topbar-scout-chip');
  }

  private get mapChip(): Locator {
    return this.page.getByTestId('topbar-map-chip');
  }

  async verifyIsVisible(): Promise<void> {
    await expect(this.panel).toBeVisible();
  }

  async clickTab(tab: HeroBoardTab): Promise<void> {
    await this.tab(tab).click();
  }

  async verifyTabActive(tab: HeroBoardTab): Promise<void> {
    await expect(this.tab(tab)).toHaveClass(/is-active/);
  }

  async verifyTabNotActive(tab: HeroBoardTab): Promise<void> {
    await expect(this.tab(tab)).not.toHaveClass(/is-active/);
  }

  async verifySkillsTabIsDisabled(): Promise<void> {
    await expect(this.tab('skills')).toBeDisabled();
  }

  async clickToggleRail(): Promise<void> {
    await this.toggleRail.click();
  }

  async verifyPanelOpen(): Promise<void> {
    await expect(this.panel).not.toHaveClass(/is-collapsed/);
  }

  async verifyPanelCollapsed(): Promise<void> {
    await expect(this.panel).toHaveClass(/is-collapsed/);
  }

  async verifyHeroTabContentVisible(): Promise<void> {
    await expect(this.heroName).toBeVisible();
    await expect(this.handsSection).toBeVisible();
    await expect(this.healthBar).toBeVisible();
    await expect(this.shieldsVitals).toBeVisible();
    await expect(this.willVitals).toBeVisible();
    await expect(this.scoutChip).toBeVisible();
    await expect(this.mapChip).toBeVisible();
  }

  async clickDetailsTab(tab: HeroDetailsTab): Promise<void> {
    await this.detailsTab(tab).click();
  }

  async verifyDetailsTabPressed(tab: HeroDetailsTab): Promise<void> {
    await expect(this.detailsTab(tab)).toHaveAttribute('aria-pressed', 'true');
  }

  async verifyScoutPathCardVisible(): Promise<void> {
    await expect(this.scoutPathCard).toBeVisible();
    await expect(this.handsSection).toBeHidden();
    await expect(this.stepsText).toBeVisible();
  }

  async verifyHeroTabContentHidden(): Promise<void> {
    await expect(this.heroName).toBeHidden();
  }

  async readStepsText(): Promise<string> {
    await this.detailsTab('path').click();
    return this.stepsText.innerText();
  }

  async verifyStepsTextChangedFrom(previous: string): Promise<void> {
    await this.detailsTab('path').click();
    await expect(this.stepsText).not.toHaveText(previous);
  }

  async verifyMapChipContains(text: string): Promise<void> {
    await expect(this.mapChip).toContainText(text);
  }

  async getHeroHealth(): Promise<TestHeroHealth> {
    return this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getHeroHealth());
  }

  async verifyHeroHealth(expected: TestHeroHealth): Promise<void> {
    await expect.poll(() => this.getHeroHealth()).toEqual(expected);
  }
}
