import { BaseFeature } from '@framework/base-feature';
import { LoginPage } from '@pages/login.page';
import { CampingMapPage } from '@pages/camping-map.page';

export class LogoutUserFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();
  private readonly loginPage = new LoginPage();

  async logout(): Promise<void> {
    await this.step('Log out from the top bar', async () => {
      await this.campingMap.topbar.logout();
      await this.loginPage.verifyStillOnLoginRoute();
    });
  }

  /**
   * The real assertion of the logout flow: logging out must clear the
   * httpOnly session cookie, so the silent `GET /auth/session` restore on the
   * next boot has nothing to restore and the router guard keeps the user on
   * /login.
   */
  async verifyRefreshDoesNotRelogin(): Promise<void> {
    await this.step('Verify a refresh after logout does not silently relogin', async () => {
      await this.loginPage.reload();
      await this.loginPage.verifyStillOnLoginRoute();
    });
  }
}
