import { expect } from '@playwright/test';
import { BaseFeature } from '@framework/base-feature';
import { LoginPage } from '@pages/login.page';

export class VerifySessionFeature extends BaseFeature {
  private readonly loginPage = new LoginPage();

  async verifyCookieIsPersistent(): Promise<void> {
    await this.step('Verify the session cookie outlives the browser session', async () => {
      const sessionCookie = await this.readSessionCookie();

      expect(sessionCookie).toBeDefined();
      expect(sessionCookie?.expires).toBeGreaterThan(Date.now() / 1000);
    });
  }

  async verifyCookieIsBrowserSessionOnly(): Promise<void> {
    await this.step('Verify the session cookie is a browser-session cookie', async () => {
      const sessionCookie = await this.readSessionCookie();

      expect(sessionCookie).toBeDefined();
      // Playwright reports -1 for cookies with no Max-Age/Expires.
      expect(sessionCookie?.expires).toBe(-1);
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

  private async readSessionCookie() {
    const cookies = await this.page.context().cookies();
    return cookies.find((cookie) => cookie.name === 'session');
  }
}
