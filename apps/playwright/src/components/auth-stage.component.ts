import { expect } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';

export class AuthStageComponent extends BaseComponent {
  async useViewport(width: number, height: number): Promise<void> {
    await this.page.setViewportSize({ width, height });
  }

  async preferReducedMotion(): Promise<void> {
    await this.page.emulateMedia({ reducedMotion: 'reduce' });
  }

  async toggleLanguage(): Promise<void> {
    await this.page.getByTestId('auth-lang').click();
  }

  async clickTaglineDot(index: number): Promise<void> {
    await this.page.getByTestId(`auth-tagline-dot-${index}`).click();
  }

  async verifyWideLayout(): Promise<void> {
    await expect(this.page.getByTestId('auth-layout-wide')).toBeVisible();
    await expect(this.page.getByTestId('auth-layout-phone')).toHaveCount(0);
    await expect(this.page.getByTestId('auth-features')).toBeVisible();
    await expect(this.page.getByTestId('auth-tagline-dot-0')).toBeVisible();
  }

  async verifyPhoneLayout(): Promise<void> {
    await expect(this.page.getByTestId('auth-layout-phone')).toBeVisible();
    await expect(this.page.getByTestId('auth-layout-wide')).toHaveCount(0);
    await expect(this.page.getByTestId('auth-features')).toHaveCount(0);
    await expect(this.page.getByTestId('auth-tagline-dot-0')).toHaveCount(0);
    await expect(this.page.getByTestId('auth-card')).toBeVisible();
  }

  async verifyCardFitsViewport(): Promise<void> {
    const box = await this.page.getByTestId('auth-card').boundingBox();
    const viewport = this.page.viewportSize();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  }

  async verifyEmblemIsFloating(): Promise<void> {
    await expect(this.page.getByTestId('auth-emblem-float')).toHaveCSS(
      'animation-name',
      'powFloat',
    );
  }

  async verifyEmblemIsStill(): Promise<void> {
    await expect(this.page.getByTestId('auth-emblem-float')).toHaveCSS('animation-name', 'none');
  }

  async verifyTagline(text: string): Promise<void> {
    await expect(this.page.getByTestId('auth-tagline')).toHaveText(text);
  }

  async verifyLanguageLabel(label: string): Promise<void> {
    await expect(this.page.getByTestId('auth-lang')).toContainText(label);
  }

  async verifyEmblemVisible(): Promise<void> {
    await expect(this.page.getByTestId('auth-emblem')).toBeVisible();
  }
}
