import { BaseFeature } from '@framework/base-feature';
import { LoginPage } from '@pages/login.page';
import { CampingMapPage } from '@pages/camping-map.page';
import { GUARDIAN_EMAIL, NEW_HERO_PASSWORD } from '@config/test-data';

function uniqueHeroName(): string {
  return `ui${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.slice(0, 20);
}

export class RegisterUserViaUiFeature extends BaseFeature {
  private readonly loginPage = new LoginPage();
  private readonly campingMap = new CampingMapPage();

  async register(): Promise<void> {
    await this.step('Create a new hero from the New hero tab', async () => {
      await this.loginPage.gotoLogin();
      await this.loginPage.tabs.select('new');
      await this.loginPage.signUp.fillName(uniqueHeroName());
      await this.loginPage.signUp.fillPassword(NEW_HERO_PASSWORD);
      await this.loginPage.signUp.fillGuardian(GUARDIAN_EMAIL);
      await this.loginPage.signUp.submit();
      await this.campingMap.waitUntilReady();
    });
  }
}
