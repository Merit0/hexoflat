import { BaseFeature } from '@framework/base-feature';
import { LoginPage } from '@pages/login.page';

/**
 * Both modes are the same Vue component (login-form.vue / LoginFormComponent) —
 * one Feature covering both, rather than two near-identical classes.
 */
export class VerifyLoginFormFeature extends BaseFeature {
  private readonly loginPage = new LoginPage();

  /**
   * Checks presence *and* interactivity, plus the absence of register-only
   * fields — "renders in the DOM" is a much weaker claim than "is a working
   * login form", and mode-specific fields leaking across modes was a real bug.
   */
  async verifyLoginModeIsUsable(): Promise<void> {
    await this.step('Verify the login form is complete and interactive', async () => {
      await this.loginPage.gotoLogin();

      await this.loginPage.form.verifyLoginFieldsAreVisible();
      await this.loginPage.form.verifyRememberMeIsCheckedByDefault();
      await this.loginPage.form.verifySubmitButtonLabel('PLAY');
      await this.loginPage.form.verifyToggleModeButtonLabel('Create account');
      await this.loginPage.form.verifyRegisterOnlyFieldsAreAbsent();

      await this.loginPage.form.fillCredentials('someone', 'whatever123');
      await this.loginPage.form.togglePasswordVisibility();
      await this.loginPage.form.verifyTypedValues('someone', 'whatever123');
      await this.loginPage.form.verifyPasswordIsRevealed();
    });
  }

  async verifyRegisterModeIsUsable(): Promise<void> {
    await this.step('Verify the register form is complete and interactive', async () => {
      await this.loginPage.gotoRegister();

      await this.loginPage.form.verifyRegisterFieldsAreVisible();
      await this.loginPage.form.verifyPasswordHintMentions('8 characters');
      await this.loginPage.form.verifySubmitButtonLabel('REGISTER');
      await this.loginPage.form.verifyToggleModeButtonLabel('Back to login');
      // Login-only field must not leak into register mode.
      await this.loginPage.form.verifyRememberMeIsAbsent();

      await this.loginPage.form.fillRegisterName('Real User');
      await this.loginPage.form.fillCredentials('real-user', 'longenoughpw');
      await this.loginPage.form.fillRegisterConfirmPassword('longenoughpw');
      await this.loginPage.form.verifyRegisterNameValue('Real User');
      await this.loginPage.form.verifyTypedValues('real-user', 'longenoughpw');
    });
  }
}
