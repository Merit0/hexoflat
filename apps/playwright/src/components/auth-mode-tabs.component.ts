import { expect } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';

export type AuthModeName = 'signin' | 'code' | 'new';

export class AuthModeTabsComponent extends BaseComponent {
  private tab(mode: AuthModeName) {
    return this.page.getByTestId(`auth-mode-${mode}`);
  }

  async select(mode: AuthModeName): Promise<void> {
    await this.tab(mode).click();
  }

  async verifySelected(mode: AuthModeName): Promise<void> {
    await expect(this.tab(mode)).toHaveAttribute('aria-pressed', 'true');
  }

  async verifyNotSelected(mode: AuthModeName): Promise<void> {
    await expect(this.tab(mode)).toHaveAttribute('aria-pressed', 'false');
  }

  async verifyVisible(mode: AuthModeName): Promise<void> {
    await expect(this.tab(mode)).toBeVisible();
  }
}
