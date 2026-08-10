import { expect } from '@playwright/test';
import { BasePage } from '@framework/base-page';
import { LoginFormComponent } from '@components/login-form.component';

/** The `/login` and `/register` routes — one Vue page rendering both modes. */
export class LoginPage extends BasePage {
  readonly form = new LoginFormComponent();

  /** The app root, which redirects an anonymous visitor to /login. */
  async gotoRoot(): Promise<void> {
    await this.page.goto('/');
  }

  async gotoLogin(): Promise<void> {
    await this.page.goto('/login');
  }

  async gotoRegister(): Promise<void> {
    await this.page.goto('/register');
  }

  async reload(): Promise<void> {
    await this.page.reload();
  }

  async verifyUrlIsLogin(): Promise<void> {
    await expect(this.page).toHaveURL(/\/login$/);
  }

  async verifyUrlIsRegister(): Promise<void> {
    await expect(this.page).toHaveURL(/\/register$/);
  }

  async verifyStillOnLoginRoute(): Promise<void> {
    await expect(this.page).toHaveURL(/\/login/);
  }

  async verifyNotRedirectedToLogin(): Promise<void> {
    await expect(this.page).not.toHaveURL(/\/login$/);
  }
}
