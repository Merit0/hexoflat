import { BaseFeature } from '@framework/base-feature';
import { LoginPage } from '@pages/login.page';
import { AuthText } from '@config/test-data';
import type { TestUser } from '@api/register-user';
import { LoginUserFeature } from './login-user.feature';
import { LogoutUserFeature } from './logout-user.feature';

export class VerifyAuthInteractionsFeature extends BaseFeature {
  private readonly loginPage = new LoginPage();

  async verifyTabsSwitchModes(): Promise<void> {
    await this.step('Verify the mode tabs move the selection between the three modes', async () => {
      await this.loginPage.gotoLogin();
      await this.loginPage.tabs.verifySelected('signin');

      await this.loginPage.tabs.select('code');
      await this.loginPage.tabs.verifySelected('code');
      await this.loginPage.tabs.verifyNotSelected('signin');
      await this.loginPage.runePad.verifySevenRunes();

      await this.loginPage.tabs.select('new');
      await this.loginPage.tabs.verifySelected('new');
      await this.loginPage.signUp.verifyFormIsComplete();

      await this.loginPage.tabs.select('signin');
      await this.loginPage.signIn.verifyFormIsComplete();
    });
  }

  async verifyEyeToggleKeepsFocus(): Promise<void> {
    await this.step(
      'Verify the eye toggle reveals the password without stealing focus',
      async () => {
        await this.loginPage.gotoLogin();
        await this.loginPage.signIn.fillCredentials('someone', 'secret-word');
        await this.loginPage.signIn.focusPassword();
        await this.loginPage.signIn.verifyPasswordIsMasked();

        await this.loginPage.signIn.toggleEye();

        await this.loginPage.signIn.verifyPasswordIsRevealed();
        await this.loginPage.signIn.verifyPasswordKeepsFocus();

        await this.loginPage.signIn.toggleEye();
        await this.loginPage.signIn.verifyPasswordIsMasked();
      },
    );
  }

  async verifyCapsLockWarning(): Promise<void> {
    await this.step('Verify the Caps Lock warning appears on the password field', async () => {
      await this.loginPage.gotoLogin();
      await this.loginPage.signIn.focusPassword();
      await this.loginPage.signIn.simulateCapsLockKeyup();
      await this.loginPage.signIn.verifyCapsWarningVisible();
    });
  }

  async verifyRecentHeroAfterSignIn(user: TestUser): Promise<void> {
    await this.step(
      'Verify a signed-in hero is offered as a recent hero and fills the name',
      async () => {
        await new LoginUserFeature(user).login();
        await new LogoutUserFeature().logout();

        await this.loginPage.signIn.verifyRecentHeroCount(1);
        await this.loginPage.signIn.pickRecentHero();
        await this.loginPage.signIn.verifyRecentHeroIsSelected();
        await this.loginPage.signIn.verifyTypedValues(user.username, '');
      },
    );
  }

  async verifyRunePad(user: TestUser): Promise<void> {
    await this.step(
      'Verify the rune pad numbers picks, resets and refuses an unbacked code',
      async () => {
        await new LoginUserFeature(user).login();
        await new LogoutUserFeature().logout();
        await this.loginPage.gotoHeroCode();

        await this.loginPage.runePad.pick('star');
        await this.loginPage.runePad.verifyError(AuthText.pickHeroFirst);
        await this.loginPage.runePad.verifyNotPicked('star');

        await this.loginPage.runePad.pickHero();
        await this.loginPage.runePad.pick('moon');
        await this.loginPage.runePad.pick('sun');
        await this.loginPage.runePad.pick('moon');
        await this.loginPage.runePad.verifyOrder('moon', 1);
        await this.loginPage.runePad.verifyOrder('sun', 2);
        await this.loginPage.runePad.verifyProgress('2 of 4 runes chosen');

        await this.loginPage.runePad.reset();
        await this.loginPage.runePad.verifyNotPicked('moon');
        await this.loginPage.runePad.verifyProgress('0 of 4 runes chosen');

        await this.loginPage.runePad.pick('leaf');
        await this.loginPage.runePad.pick('flame');
        await this.loginPage.runePad.pick('drop');
        await this.loginPage.runePad.pick('bolt');
        await this.loginPage.runePad.verifyError(AuthText.notAvailable);
        await this.loginPage.runePad.verifyProgress('0 of 4 runes chosen');
      },
    );
  }

  async verifyPasskeyIsHonestlyUnavailable(): Promise<void> {
    await this.step('Verify the passkey button explains it is not available yet', async () => {
      await this.loginPage.gotoLogin();
      await this.loginPage.signIn.clickPasskey();
      await this.loginPage.signIn.verifyError(AuthText.notAvailable);
    });
  }

  async verifyLanguageSwitch(): Promise<void> {
    await this.step(
      'Verify the language button switches the card to Ukrainian and back',
      async () => {
        await this.loginPage.gotoLogin();
        await this.loginPage.stage.verifyLanguageLabel('EN');
        await this.loginPage.stage.verifyTagline('Every step takes Will. Spend it wisely.');

        await this.loginPage.stage.toggleLanguage();
        await this.loginPage.stage.verifyLanguageLabel('UA');
        await this.loginPage.stage.verifyTagline('Кожен крок потребує Волі. Витрачай її мудро.');

        await this.loginPage.stage.toggleLanguage();
        await this.loginPage.stage.verifyLanguageLabel('EN');
      },
    );
  }

  async verifyTaglineDotJumps(): Promise<void> {
    await this.step('Verify a tagline dot jumps to its line', async () => {
      await this.loginPage.gotoLogin();
      await this.loginPage.stage.clickTaglineDot(2);
      await this.loginPage.stage.verifyTagline('Friends can join your adventure at any time.');
    });
  }
}
