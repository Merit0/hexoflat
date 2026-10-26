import { expect, type Locator } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';
import type { TestHeroHealth } from '@framework/test-api';

export type HeroBoardTab = 'hero' | 'inventory' | 'path' | 'events';
export type HeroDetailsTab = 'state' | 'skills';
export type SacrificeOption = 'small' | 'medium' | 'all';
export type HeroSkillId =
  'b_crest' | 'b_strike' | 'b_guard' | 'b_heavy' | 'd_crest' | 'a_crest' | 'a_teleport';
export type HeroHand = 'right' | 'left';

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

  private skillNode(id: HeroSkillId): Locator {
    return this.page.getByTestId(`hero-skill-node-${id}`);
  }

  private skillNodeRank(id: HeroSkillId): Locator {
    return this.page.getByTestId(`hero-skill-node-${id}-rank`);
  }

  private get skillDetailName(): Locator {
    return this.page.getByTestId('hero-skill-detail-name');
  }

  private get skillDetailRank(): Locator {
    return this.page.getByTestId('hero-skill-detail-rank');
  }

  private get skillDetailRequires(): Locator {
    return this.page.getByTestId('hero-skill-detail-requires');
  }

  private sacrificeButton(option: SacrificeOption): Locator {
    return this.page.getByTestId(`hero-skill-sacrifice-${option}`);
  }

  private get skillProgressValue(): Locator {
    return this.page.getByTestId('hero-skill-detail').getByTestId('hero-skill-progress-value');
  }

  private get skillTreeWill(): Locator {
    return this.page.getByTestId('hero-skill-will');
  }

  private get resetButton(): Locator {
    return this.page.getByTestId('hero-skill-reset');
  }

  private get resetConfirmButton(): Locator {
    return this.page.getByTestId('hero-skill-reset-confirm');
  }

  private heartNests(): Locator {
    return this.page.locator('[data-testid^="hero-vitals-hearts-nest-"]');
  }

  private get heartsValue(): Locator {
    return this.page.getByTestId('hero-vitals-hearts-value');
  }

  private get attackTileValue(): Locator {
    return this.page.getByTestId('hero-stat-attack-value');
  }

  private handName(hand: HeroHand): Locator {
    return this.page.getByTestId(`hero-hand-${hand}-name`);
  }

  private handWill(hand: HeroHand): Locator {
    return this.page.getByTestId(`hero-hand-${hand}-will`);
  }

  private handEmpty(hand: HeroHand): Locator {
    return this.page.getByTestId(`hero-hand-${hand}-empty`);
  }

  private get skillTree(): Locator {
    return this.page.getByTestId('hero-skill-tree');
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

  async verifyHeartsMatchHealth(): Promise<void> {
    const health = await this.getHeroHealth();
    await expect(this.heartNests()).toHaveCount(Math.ceil(health.max));
    await expect(this.heartsValue).toContainText(
      new RegExp(`${health.current}\\s*/\\s*${health.max}`),
    );
  }

  async verifyHandEmpty(hand: HeroHand): Promise<void> {
    await expect(this.handEmpty(hand)).toBeVisible();
    await expect(this.handName(hand)).toBeHidden();
  }

  async verifyHandHolds(hand: HeroHand, name: RegExp): Promise<void> {
    await expect(this.handName(hand)).toHaveText(name);
    await expect(this.handEmpty(hand)).toBeHidden();
  }

  async clickHandIcon(hand: HeroHand): Promise<void> {
    await this.page.getByTestId(`hero-hand-${hand}-label`).click();
  }

  async verifyHandIconDisabled(hand: HeroHand): Promise<void> {
    await expect(this.page.getByTestId(`hero-hand-${hand}-label`)).toBeDisabled();
  }

  async verifyHandWillCost(hand: HeroHand, will: number | null): Promise<void> {
    if (will === null) await expect(this.handWill(hand)).toBeHidden();
    else await expect(this.handWill(hand)).toContainText(String(will));
  }

  async readAttackTileText(): Promise<string> {
    return this.attackTileValue.innerText();
  }

  async verifyAttackTileChangedFrom(previous: string): Promise<void> {
    await expect(this.attackTileValue).not.toHaveText(previous);
  }

  async verifySkillTreeVisible(): Promise<void> {
    await expect(this.skillTree).toBeVisible();
  }

  async selectSkill(id: HeroSkillId): Promise<void> {
    await this.skillNode(id).click();
  }

  async sacrifice(option: SacrificeOption): Promise<void> {
    await this.sacrificeButton(option).click();
  }

  async verifySacrificeDisabled(option: SacrificeOption): Promise<void> {
    await expect(this.sacrificeButton(option)).toBeDisabled();
  }

  async verifySacrificeEnabled(option: SacrificeOption): Promise<void> {
    await expect(this.sacrificeButton(option)).toBeEnabled();
  }

  async verifySacrificeHidden(): Promise<void> {
    await expect(this.sacrificeButton('small')).toBeHidden();
  }

  async verifySelectedSkillProgress(progress: number, cost: number): Promise<void> {
    await expect(this.skillProgressValue).toHaveText(`${progress}/${cost}`);
  }

  async verifySkillTreeWill(will: number): Promise<void> {
    await expect(this.skillTreeWill).toContainText(new RegExp(`^\\s*${will}\\b`));
  }

  async resetAllSkills(): Promise<void> {
    await this.resetButton.click();
    await this.resetConfirmButton.click();
  }

  async verifyResetDisabled(): Promise<void> {
    await expect(this.resetButton).toBeDisabled();
  }

  async verifySelectedSkillName(name: RegExp): Promise<void> {
    await expect(this.skillDetailName).toHaveText(name);
  }

  async verifySelectedSkillRank(rank: number, maxRank: number): Promise<void> {
    await expect(this.skillDetailRank).toContainText(
      new RegExp(`\\b${rank}\\s*/\\s*${maxRank}\\b`),
    );
  }

  async verifySkillNodeRank(id: HeroSkillId, rank: number): Promise<void> {
    await expect(this.skillNodeRank(id)).toHaveText(String(rank));
  }

  async verifySelectedSkillRequirementsShown(names: RegExp): Promise<void> {
    await expect(this.skillDetailRequires).toBeVisible();
    await expect(this.skillDetailRequires).toContainText(names);
  }

  async verifySelectedSkillRequirementsHidden(): Promise<void> {
    await expect(this.skillDetailRequires).toBeHidden();
  }

  async verifyHeroTabContentHidden(): Promise<void> {
    await expect(this.heroName).toBeHidden();
  }

  async readStepsText(): Promise<string> {
    await this.detailsTab('skills').click();
    return this.stepsText.innerText();
  }

  async verifyStepsTextChangedFrom(previous: string): Promise<void> {
    await this.detailsTab('skills').click();
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
