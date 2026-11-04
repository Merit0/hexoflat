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
}
