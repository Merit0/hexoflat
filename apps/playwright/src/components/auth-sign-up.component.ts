import { expect } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';

export class AuthSignUpComponent extends BaseComponent {
  private get nameInput() {
    return this.page.getByTestId('auth-new-name');
  }

  private get passwordInput() {
    return this.page.getByTestId('auth-new-password');
  }

  private get guardianInput() {
    return this.page.getByTestId('auth-guardian-email');
  }

  private get submitButton() {
    return this.page.getByTestId('auth-new-submit');
  }

  private get strength() {
    return this.page.getByTestId('auth-strength');
  }

  private get forgeLabel() {
    return this.page.getByTestId('auth-forge-label');
  }

  private get errorAlert() {
    return this.page.getByTestId('auth-error');
  }

  private grade(value: number) {
    return this.page.getByTestId(`auth-grade-${value}`);
  }

  async fillName(name: string): Promise<void> {
    await this.nameInput.fill(name);
  }

  async fillPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password);
  }

  async fillGuardian(email: string): Promise<void> {
    await this.guardianInput.fill(email);
  }

  async chooseGrade(value: number): Promise<void> {
    await this.grade(value).click();
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async verifyFormIsComplete(): Promise<void> {
    await expect(this.nameInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.guardianInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  async verifySignInOnlyFieldsAreAbsent(): Promise<void> {
    await expect(this.page.getByTestId('auth-name')).toHaveCount(0);
    await expect(this.page.getByTestId('auth-remember')).toHaveCount(0);
  }

  async verifyStrength(label: string): Promise<void> {
    await expect(this.strength).toContainText(label);
  }

  async verifyGradeSelected(value: number): Promise<void> {
    await expect(this.grade(value)).toHaveAttribute('aria-pressed', 'true');
  }

  async verifyForgeLabel(text: string): Promise<void> {
    await expect(this.forgeLabel).toHaveText(text);
  }

  async verifyError(text: string): Promise<void> {
    await expect(this.errorAlert).toHaveText(text);
  }

  async verifyNameValue(name: string): Promise<void> {
    await expect(this.nameInput).toHaveValue(name);
  }
}
