import { expect } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';

/**
 * The login/register form (apps/web's login-form.vue). One component for
 * both modes — it is literally one Vue component rendering either set of
 * fields, and the tests that matter are exactly the ones checking that
 * mode-specific fields do *not* leak across.
 */
export class LoginFormComponent extends BaseComponent {
  private get usernameInput() {
    return this.page.getByTestId('login-username-input');
  }

  private get passwordInput() {
    return this.page.getByTestId('login-password-input');
  }

  private get togglePasswordButton() {
    return this.page.getByTestId('login-toggle-password-button');
  }

  private get rememberMeCheckbox() {
    return this.page.getByTestId('login-remember-me-checkbox');
  }

  private get submitButton() {
    return this.page.getByTestId('login-submit-button');
  }

  private get toggleModeButton() {
    return this.page.getByTestId('login-toggle-mode-button');
  }

  private get errorMessage() {
    return this.page.getByTestId('login-error-message');
  }

  private get registerNameInput() {
    return this.page.getByTestId('register-name-input');
  }

  private get registerConfirmPasswordInput() {
    return this.page.getByTestId('register-confirm-password-input');
  }

  private get registerPasswordHint() {
    return this.page.getByTestId('register-password-hint');
  }

  async fillCredentials(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
  }

  async fillRegisterName(name: string): Promise<void> {
    await this.registerNameInput.fill(name);
  }

  async fillRegisterConfirmPassword(password: string): Promise<void> {
    await this.registerConfirmPasswordInput.fill(password);
  }

  async uncheckRememberMe(): Promise<void> {
    await this.rememberMeCheckbox.uncheck();
  }

  async togglePasswordVisibility(): Promise<void> {
    await this.togglePasswordButton.click();
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async toggleMode(): Promise<void> {
    await this.toggleModeButton.click();
  }

  async verifyErrorIsVisible(): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
  }

  async verifySubmitButtonLabel(label: string): Promise<void> {
    await expect(this.submitButton).toHaveText(label);
  }

  async verifyToggleModeButtonLabel(label: string): Promise<void> {
    await expect(this.toggleModeButton).toHaveText(label);
  }

  async verifyRegisterNameInputIsVisible(): Promise<void> {
    await expect(this.registerNameInput).toBeVisible();
  }

  async verifyLoginFieldsAreVisible(): Promise<void> {
    await expect(this.usernameInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.togglePasswordButton).toBeVisible();
    await expect(this.rememberMeCheckbox).toBeVisible();
  }

  /**
   * Default matters here: unchecked-by-default would silently regress every
   * user who never touches the box from "stays logged in" to "logged out on
   * browser close" — see docs/REMEMBER-ME-PLAN.md.
   */
  async verifyRememberMeIsCheckedByDefault(): Promise<void> {
    await expect(this.rememberMeCheckbox).toBeChecked();
  }

  async verifyRegisterOnlyFieldsAreAbsent(): Promise<void> {
    await expect(this.registerNameInput).toHaveCount(0);
    await expect(this.registerConfirmPasswordInput).toHaveCount(0);
    await expect(this.registerPasswordHint).toHaveCount(0);
  }

  async verifyRegisterFieldsAreVisible(): Promise<void> {
    await expect(this.registerNameInput).toBeVisible();
    await expect(this.usernameInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.registerConfirmPasswordInput).toBeVisible();
  }

  async verifyPasswordHintMentions(text: string): Promise<void> {
    await expect(this.registerPasswordHint).toContainText(text);
  }

  async verifyRememberMeIsAbsent(): Promise<void> {
    await expect(this.rememberMeCheckbox).toHaveCount(0);
  }

  async verifyTypedValues(username: string, password: string): Promise<void> {
    await expect(this.usernameInput).toHaveValue(username);
    await expect(this.passwordInput).toHaveValue(password);
  }

  async verifyRegisterNameValue(name: string): Promise<void> {
    await expect(this.registerNameInput).toHaveValue(name);
  }

  async verifyPasswordIsRevealed(): Promise<void> {
    await expect(this.passwordInput).toHaveAttribute('type', 'text');
  }
}
