import { expect } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';

export class AuthSignInComponent extends BaseComponent {
  private get nameInput() {
    return this.page.getByTestId('auth-name');
  }

  private get passwordInput() {
    return this.page.getByTestId('auth-password');
  }

  private get passwordToggle() {
    return this.page.getByTestId('auth-password-toggle');
  }

  private get rememberSwitch() {
    return this.page.getByTestId('auth-remember');
  }

  private get submitButton() {
    return this.page.getByTestId('auth-submit');
  }

  private get errorAlert() {
    return this.page.getByTestId('auth-error');
  }

  private get recentHeroes() {
    return this.page.getByTestId('auth-recent-hero');
  }

  private get capsWarning() {
    return this.page.getByTestId('auth-caps');
  }

  private get passkeyButton() {
    return this.page.getByTestId('auth-passkey');
  }

  async fillCredentials(name: string, password: string): Promise<void> {
    await this.nameInput.fill(name);
    await this.passwordInput.fill(password);
  }

  async turnRememberOff(): Promise<void> {
    if ((await this.rememberSwitch.getAttribute('aria-checked')) === 'true') {
      await this.rememberSwitch.click();
    }
    await expect(this.rememberSwitch).toHaveAttribute('aria-checked', 'false');
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async toggleEye(): Promise<void> {
    await this.passwordToggle.click();
  }

  async focusPassword(): Promise<void> {
    await this.passwordInput.focus();
  }

  async pickRecentHero(): Promise<void> {
    await this.recentHeroes.first().click();
  }

  async simulateCapsLockKeyup(): Promise<void> {
    await this.passwordInput.dispatchEvent('keyup', { key: 'a', modifierCapsLock: true });
  }

  async verifyFormIsComplete(): Promise<void> {
    await expect(this.nameInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.passwordToggle).toBeVisible();
    await expect(this.rememberSwitch).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  async verifyRememberIsOnByDefault(): Promise<void> {
    await expect(this.rememberSwitch).toHaveAttribute('aria-checked', 'true');
  }

  async verifyError(text: string): Promise<void> {
    await expect(this.errorAlert).toHaveText(text);
  }

  async verifyErrorIsGone(): Promise<void> {
    await expect(this.errorAlert).toHaveCount(0);
  }

  async verifyTypedValues(name: string, password: string): Promise<void> {
    await expect(this.nameInput).toHaveValue(name);
    await expect(this.passwordInput).toHaveValue(password);
  }

  async verifyPasswordIsMasked(): Promise<void> {
    await expect(this.passwordInput).toHaveAttribute('type', 'password');
  }

  async verifyPasswordIsRevealed(): Promise<void> {
    await expect(this.passwordInput).toHaveAttribute('type', 'text');
  }

  async verifyPasswordKeepsFocus(): Promise<void> {
    await expect(this.passwordInput).toBeFocused();
  }

  async verifyRecentHeroCount(count: number): Promise<void> {
    await expect(this.recentHeroes).toHaveCount(count);
  }

  async verifyRecentHeroIsSelected(): Promise<void> {
    await expect(this.recentHeroes.first()).toHaveAttribute('aria-pressed', 'true');
  }

  async verifyCapsWarningVisible(): Promise<void> {
    await expect(this.capsWarning).toBeVisible();
  }

  async verifyPasskeyVisible(): Promise<void> {
    await expect(this.passkeyButton).toBeVisible();
  }

  async clickPasskey(): Promise<void> {
    await this.passkeyButton.click();
  }
}
