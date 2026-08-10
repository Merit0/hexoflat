import { BaseFeature } from '@framework/base-feature';
import { LoginPage } from '@pages/login.page';

export class RegisterUserFeature extends BaseFeature {
  private readonly loginPage = new LoginPage();

  /** Switches to register mode via the toggle and confirms it got its own route. */
  async openRegisterMode(): Promise<void> {
    await this.step('Switch the login form into register mode', async () => {
      await this.loginPage.gotoLogin();
      await this.loginPage.form.toggleMode();
      await this.loginPage.verifyUrlIsRegister();
      await this.loginPage.form.verifyRegisterNameInputIsVisible();
    });
  }

  async verifyRegisterModeSurvivesReload(): Promise<void> {
    await this.step('Verify register mode survives a reload of its own route', async () => {
      await this.loginPage.reload();
      await this.loginPage.verifyUrlIsRegister();
      await this.loginPage.form.verifyRegisterNameInputIsVisible();
      await this.loginPage.form.verifyToggleModeButtonLabel('Back to login');
    });
  }

  async verifyRegisterFormIsUsable(): Promise<void> {
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

  /**
   * Simulates a bookmarked/shared link: the router must resolve /register
   * directly (not only via the "Create account" toggle), and login-form.vue's
   * defensive `userStore.logout()` on mount must not force-navigate back to
   * /login. That force-navigate was a real bug — unconditional, and harmless
   * only while the component rendered exclusively at /login.
   */
  async verifyDirectRegisterUrlSurvivesReload(): Promise<void> {
    await this.step('Verify a direct /register visit survives a reload', async () => {
      await this.loginPage.gotoRegister();
      await this.loginPage.verifyUrlIsRegister();
      await this.loginPage.form.verifyRegisterNameInputIsVisible();

      await this.loginPage.reload();

      await this.loginPage.verifyNotRedirectedToLogin();
      await this.loginPage.verifyUrlIsRegister();
      await this.loginPage.form.verifyRegisterNameInputIsVisible();
      await this.loginPage.form.verifyToggleModeButtonLabel('Back to login');
    });
  }

  /** Proves the toggle still works after a reload, not just that the route survived it. */
  async verifyToggleBackToLoginWorks(): Promise<void> {
    await this.step('Verify toggling back to login mode still works', async () => {
      await this.loginPage.form.toggleMode();
      await this.loginPage.verifyUrlIsLogin();
      await this.loginPage.form.verifyRegisterOnlyFieldsAreAbsent();
    });
  }
}
