import { BaseFeature } from '@framework/base-feature';
import { LoginPage } from '@pages/login.page';

export class VerifyRegisterRouteFeature extends BaseFeature {
  private readonly loginPage = new LoginPage();

  /** Assumes the app is already on /register (e.g. via OpenRegisterFeature.open()). */
  async verifySurvivesReload(): Promise<void> {
    await this.step('Verify register mode survives a reload of its own route', async () => {
      await this.loginPage.reload();
      await this.loginPage.verifyUrlIsRegister();
      await this.loginPage.form.verifyRegisterNameInputIsVisible();
      await this.loginPage.form.verifyToggleModeButtonLabel('Back to login');
    });
  }

  /**
   * Simulates a bookmarked/shared link: the router must resolve /register
   * directly (not only via the "Create account" toggle), and login-form.vue's
   * defensive `userStore.logout()` on mount must not force-navigate back to
   * /login. That force-navigate was a real bug — unconditional, and harmless
   * only while the component rendered exclusively at /login.
   */
  async verifyDirectUrlSurvivesReload(): Promise<void> {
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
