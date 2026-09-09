import { expect, type Locator } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';
import type { TestHeroHealth } from '@framework/test-api';

export type HeroBoardTab = 'hero' | 'inventory' | 'skills' | 'events';

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

  private get faithBar(): Locator {
    return this.page.getByTestId('hero-faith-bar');
  }

  private get healthBar(): Locator {
    return this.page.getByTestId('topbar-hp-bar');
  }

  private get defenceBar(): Locator {
    return this.page.getByTestId('hero-defence-bar');
  }

  private get stepsChip(): Locator {
    return this.page.getByTestId('topbar-steps-chip');
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
    await expect(this.faithBar).toBeVisible();
    await expect(this.healthBar).toBeVisible();
    await expect(this.defenceBar).toBeVisible();
    await expect(this.stepsChip).toBeVisible();
    await expect(this.scoutChip).toBeVisible();
    await expect(this.mapChip).toBeVisible();
  }

  async verifyHeroTabContentHidden(): Promise<void> {
    await expect(this.heroName).toBeHidden();
  }

  async readStepsText(): Promise<string> {
    return this.stepsChip.innerText();
  }

  async verifyStepsTextChangedFrom(previous: string): Promise<void> {
    await expect(this.stepsChip).not.toHaveText(previous);
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
