import { expect } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';

const RUNE_NAMES = ['star', 'moon', 'leaf', 'flame', 'drop', 'bolt', 'sun'] as const;

export type RuneName = 'star' | 'moon' | 'leaf' | 'flame' | 'drop' | 'bolt' | 'sun';

export class AuthRunePadComponent extends BaseComponent {
  private rune(id: RuneName) {
    return this.page.getByTestId(`auth-rune-${id}`);
  }

  async pick(id: RuneName): Promise<void> {
    await this.rune(id).click();
  }

  async reset(): Promise<void> {
    await this.page.getByTestId('auth-rune-reset').click();
  }

  async pickHero(): Promise<void> {
    await this.page.getByTestId('auth-recent-hero').first().click();
  }

  async verifyOrder(id: RuneName, order: number): Promise<void> {
    await expect(this.rune(id).getByTestId('auth-rune-order')).toHaveText(String(order));
  }

  async verifyNotPicked(id: RuneName): Promise<void> {
    await expect(this.rune(id).getByTestId('auth-rune-order')).toHaveCount(0);
  }

  async verifyProgress(label: string): Promise<void> {
    await expect(this.page.getByTestId('auth-rune-progress')).toHaveAttribute('aria-label', label);
  }

  async verifyError(text: string): Promise<void> {
    await expect(this.page.getByTestId('auth-error')).toHaveText(text);
  }

  async verifySevenRunes(): Promise<void> {
    for (const id of RUNE_NAMES) {
      await expect(this.rune(id)).toBeVisible();
    }
  }
}
