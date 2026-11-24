import { expect } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';

export type HexInfoSealState = 'broken' | 'locked' | 'interactable' | 'empty';

export class HexInfoTooltipComponent extends BaseComponent {
  private get tooltip() {
    return this.page.getByTestId('hex-info-tooltip');
  }

  async verifyTitle(title: RegExp): Promise<void> {
    await expect(this.tooltip).toBeVisible();
    await expect(this.page.getByTestId('hex-info-title')).toHaveText(title);
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

  async verifyTokenType(label: RegExp): Promise<void> {
    await expect(this.tooltip).toBeVisible();
    await expect(this.page.getByTestId('hex-info-token-type')).toHaveText(label);
  }

  async verifyNoTokenType(): Promise<void> {
    await expect(this.tooltip).toBeVisible();
    await expect(this.page.getByTestId('hex-info-token-type')).toHaveCount(0);
  }

  async verifyDividerFollowsLight(): Promise<void> {
    const tone = await this.page.getByTestId('hex-info-token-type').getAttribute('data-light');
    await expect(this.page.getByTestId('hex-info-divider')).toHaveAttribute(
      'data-light',
      tone ?? 'missing',
    );
  }

  async verifyDividerHasNoLight(): Promise<void> {
    await expect(this.page.getByTestId('hex-info-divider')).toHaveAttribute('data-light', 'none');
  }

  async verifyIsHidden(): Promise<void> {
    await expect(this.tooltip).toHaveCount(0);
  }

  async verifyEffectIsShown(): Promise<void> {
    await expect(this.tooltip).toBeVisible();
    await expect(this.page.getByTestId('hex-info-effect')).toBeVisible();
  }
}
