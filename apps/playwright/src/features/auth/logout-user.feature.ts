import { BaseFeature } from '@framework/base-feature';
import { LoginPage } from '@pages/login.page';
import { CampingMapPage } from '@pages/camping-map.page';

export class LogoutUserFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();
  private readonly loginPage = new LoginPage();

  async logout(): Promise<void> {
    await this.step('Log out from the map session controls', async () => {
      await this.campingMap.mapSessionControls.clickLogout();
      await this.loginPage.verifyStillOnLoginRoute();
    });
  }
}
