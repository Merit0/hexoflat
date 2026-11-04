import { BaseFeature } from '@framework/base-feature';
import { LoginPage } from '@pages/login.page';
import { CampingMapPage } from '@pages/camping-map.page';
import { AuthText } from '@config/test-data';
import type { TestUser } from '@api/register-user';

export class LoginUserFeature extends BaseFeature {
  private readonly loginPage = new LoginPage();
  private readonly campingMap = new CampingMapPage();

  constructor(private readonly user: TestUser) {
    super();
  }

  async login(): Promise<void> {
    await this.step(`Log in as "${this.user.username}"`, async () => {
      await this.loginPage.gotoRoot();
      await this.loginPage.signIn.fillCredentials(this.user.username, this.user.password);
      await this.loginPage.signIn.submit();
      await this.campingMap.waitUntilReady();
    });
  }

  async loginWithoutRememberMe(): Promise<void> {
    await this.step(`Log in as "${this.user.username}" with "keep me signed in" off`, async () => {
      await this.loginPage.gotoRoot();
      await this.loginPage.signIn.fillCredentials(this.user.username, this.user.password);
      await this.loginPage.signIn.turnRememberOff();
      await this.loginPage.signIn.submit();
      await this.campingMap.waitUntilReady();
    });
  }

  async loginExpectingError(username: string, password: string): Promise<void> {
    await this.step(`Log in as "${username}" and expect the credentials error`, async () => {
      await this.loginPage.gotoRoot();
      await this.loginPage.signIn.fillCredentials(username, password);
      await this.loginPage.signIn.submit();
      await this.loginPage.signIn.verifyError(AuthText.badCredentials);
      await this.loginPage.verifyStillOnLoginRoute();
    });
  }
}
