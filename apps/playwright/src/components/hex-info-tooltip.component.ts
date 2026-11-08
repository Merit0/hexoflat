import { expect } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';

export type HexInfoSealState = 'broken' | 'locked' | 'interactable';

export class HexInfoTooltipComponent extends BaseComponent {
  private get tooltip() {
    return this.page.getByTestId('hex-info-tooltip');
  }

  async verifyTitle(title: RegExp): Promise<void> {
    await expect(this.tooltip).toBeVisible();
    await expect(this.page.getByTestId('hex-info-title')).toHaveText(title);
  }

  async verifyKindIsShown(): Promise<void> {
    await expect(this.page.getByTestId('hex-info-kind')).toHaveText(/\S/);
  }

  async verifySealState(state: HexInfoSealState): Promise<void> {
    await expect(this.tooltip).toBeVisible();
    await expect(this.page.getByTestId('hex-info-seal')).toHaveAttribute('data-state', state);
  }

  async verifyIconIsShown(): Promise<void> {
    await expect(this.tooltip).toBeVisible();
    await expect(this.page.getByTestId('hex-info-icon')).toBeVisible();
  }

  async verifyNoIcon(): Promise<void> {
    await expect(this.tooltip).toBeVisible();
    await expect(this.page.getByTestId('hex-info-icon')).toHaveCount(0);
  }

  async verifyRarity(label: RegExp): Promise<void> {
    await expect(this.tooltip).toBeVisible();
    await expect(this.page.getByTestId('hex-info-rarity')).toHaveText(label);
  }

  async verifyNoRarity(): Promise<void> {
    await expect(this.tooltip).toBeVisible();
    await expect(this.page.getByTestId('hex-info-rarity')).toHaveCount(0);
  }

  async verifyDividerFollowsRarity(): Promise<void> {
    const tone = await this.page.getByTestId('hex-info-rarity').getAttribute('data-rarity-tone');
    await expect(this.page.getByTestId('hex-info-divider')).toHaveAttribute(
      'data-rarity-tone',
      tone ?? 'missing',
    );
  }

  async verifyDividerHasNoRarity(): Promise<void> {
    await expect(this.page.getByTestId('hex-info-divider')).toHaveAttribute(
      'data-rarity-tone',
      'none',
    );
  }

  async verifyIsHidden(): Promise<void> {
    await expect(this.tooltip).toHaveCount(0);
  }
}
