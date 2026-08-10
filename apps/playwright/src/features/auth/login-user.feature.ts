import { expect } from '@playwright/test';
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

  /**
   * Checks presence *and* interactivity, plus the absence of register-only
   * fields — "renders in the DOM" is a much weaker claim than "is a working
   * login form", and mode-specific fields leaking across modes was a real bug.
   */
  async verifyLoginFormIsUsable(): Promise<void> {
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

  async verifySessionCookieIsPersistent(): Promise<void> {
    await this.step('Verify the session cookie outlives the browser session', async () => {
      const sessionCookie = await this.readSessionCookie();

      expect(sessionCookie).toBeDefined();
      expect(sessionCookie?.expires).toBeGreaterThan(Date.now() / 1000);
    });
  }

  async verifySessionCookieIsBrowserSessionOnly(): Promise<void> {
    await this.step('Verify the session cookie is a browser-session cookie', async () => {
      const sessionCookie = await this.readSessionCookie();

      expect(sessionCookie).toBeDefined();
      // Playwright reports -1 for cookies with no Max-Age/Expires.
      expect(sessionCookie?.expires).toBe(-1);
    });
  }

  private async readSessionCookie() {
    const cookies = await this.page.context().cookies();
    return cookies.find((cookie) => cookie.name === 'session');
  }
}
