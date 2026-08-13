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
}
