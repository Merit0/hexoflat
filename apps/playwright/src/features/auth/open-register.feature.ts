import { BaseFeature } from '@framework/base-feature';
import { LoginPage } from '@pages/login.page';

export class OpenRegisterFeature extends BaseFeature {
  private readonly loginPage = new LoginPage();

  /** Switches to register mode via the toggle and confirms it got its own route. */
  async open(): Promise<void> {
    await this.step('Switch the Login form into Register Mode', async () => {
      await this.loginPage.gotoLogin();
      await this.loginPage.form.toggleMode();
      await this.loginPage.verifyUrlIsRegister();
      await this.loginPage.form.verifyRegisterNameInputIsVisible();
    });
  }
}
