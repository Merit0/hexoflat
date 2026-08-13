import { BaseFeature } from '@framework/base-feature';
import { LoginPage } from '@pages/login.page';
import { CampingMapPage } from '@pages/camping-map.page';
import type { TestUser } from '@api/register-user';

export class LoginUserFeature extends BaseFeature {
  private readonly loginPage = new LoginPage();
  private readonly campingMap = new CampingMapPage();

  constructor(private readonly user: TestUser) {
    super();
  }

  /** Full UI login, ending on a board that is genuinely ready to be driven. */
  async login(): Promise<void> {
    await this.step(`Log in as "${this.user.username}"`, async () => {
      await this.loginPage.gotoRoot();
      await this.loginPage.form.fillCredentials(this.user.username, this.user.password);
      await this.loginPage.form.submit();
      await this.campingMap.waitUntilReady();
    });
  }

  async loginWithoutRememberMe(): Promise<void> {
    await this.step(`Log in as "${this.user.username}" with "remember me" unchecked`, async () => {
      await this.loginPage.gotoRoot();
      await this.loginPage.form.fillCredentials(this.user.username, this.user.password);
      await this.loginPage.form.uncheckRememberMe();
      await this.loginPage.form.submit();
      await this.campingMap.waitUntilReady();
    });
  }

  async loginExpectingError(username: string, password: string): Promise<void> {
    await this.step(`Log in as "${username}" and expect an inline error`, async () => {
      await this.loginPage.gotoRoot();
      await this.loginPage.form.fillCredentials(username, password);
      await this.loginPage.form.submit();
      await this.loginPage.form.verifyErrorIsVisible();
      await this.loginPage.verifyStillOnLoginRoute();
    });
  }
}
