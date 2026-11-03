import { BaseFeature } from '@framework/base-feature';
import { LoginPage } from '@pages/login.page';

export class VerifyAuthLayoutFeature extends BaseFeature {
  private readonly loginPage = new LoginPage();

  async verifyDesktopLayout(): Promise<void> {
    await this.step('Verify the two-column desktop layout at 1440x900', async () => {
      await this.loginPage.stage.useViewport(1440, 900);
      await this.loginPage.gotoLogin();
      await this.loginPage.stage.verifyWideLayout();
      await this.loginPage.stage.verifyEmblemVisible();
    });
  }

  async verifyTabletLayout(): Promise<void> {
    await this.step(
      'Verify the tablet portrait layout keeps card and brand on screen',
      async () => {
        await this.loginPage.stage.useViewport(768, 1024);
        await this.loginPage.gotoLogin();
        await this.loginPage.stage.verifyWideLayout();
        await this.loginPage.stage.verifyCardFitsViewport();
      },
    );
  }

  async verifyPhoneLayout(): Promise<void> {
    await this.step('Verify the phone bottom sheet at 390x844', async () => {
      await this.loginPage.stage.useViewport(390, 844);
      await this.loginPage.gotoLogin();
      await this.loginPage.stage.verifyPhoneLayout();
      await this.loginPage.stage.verifyCardFitsViewport();
      await this.loginPage.signIn.verifyFormIsComplete();
    });
  }

  async verifySmallestPhoneInUkrainian(): Promise<void> {
    await this.step('Verify the 320px Ukrainian card does not overflow sideways', async () => {
      await this.loginPage.stage.useViewport(320, 640);
      await this.loginPage.gotoLogin();
      await this.loginPage.stage.toggleLanguage();
      await this.loginPage.stage.verifyPhoneLayout();
      await this.loginPage.stage.verifyCardFitsViewport();
    });
  }

  async verifyMotionIsRunningByDefault(): Promise<void> {
    await this.step('Verify the emblem floats when motion is allowed', async () => {
      await this.loginPage.gotoLogin();
      await this.loginPage.stage.verifyEmblemIsFloating();
    });
  }

  async verifyReducedMotionStopsAnimation(): Promise<void> {
    await this.step('Verify reduced motion stops the emblem animation', async () => {
      await this.loginPage.stage.preferReducedMotion();
      await this.loginPage.gotoLogin();
      await this.loginPage.stage.verifyEmblemIsStill();
    });
  }
}
