import { expect } from '@playwright/test';
import { BasePage } from '@framework/base-page';
import { AuthModeTabsComponent } from '@components/auth-mode-tabs.component';
import { AuthRunePadComponent } from '@components/auth-rune-pad.component';
import { AuthSignInComponent } from '@components/auth-sign-in.component';
import { AuthSignUpComponent } from '@components/auth-sign-up.component';
import { AuthStageComponent } from '@components/auth-stage.component';

export class LoginPage extends BasePage {
  readonly tabs = new AuthModeTabsComponent();
  readonly signIn = new AuthSignInComponent();
  readonly signUp = new AuthSignUpComponent();
  readonly runePad = new AuthRunePadComponent();
  readonly stage = new AuthStageComponent();

  async gotoRoot(): Promise<void> {
    await this.page.goto('/');
  }

  async gotoLogin(): Promise<void> {
    await this.page.goto('/login');
  }

  async gotoRegister(): Promise<void> {
    await this.page.goto('/register');
  }

  async gotoHeroCode(): Promise<void> {
    await this.page.goto('/login?mode=code');
  }

  async reload(): Promise<void> {
    await this.page.reload();
  }

  async verifyUrlIsLogin(): Promise<void> {
    await expect(this.page).toHaveURL(/\/login$/);
  }

  async verifyUrlIsNewHero(): Promise<void> {
    await expect(this.page).toHaveURL(/\/login\?mode=new$/);
  }

  async verifyStillOnLoginRoute(): Promise<void> {
    await expect(this.page).toHaveURL(/\/login/);
  }

  async verifyNotRedirectedToLogin(): Promise<void> {
    await expect(this.page).not.toHaveURL(/\/login/);
  }
}
