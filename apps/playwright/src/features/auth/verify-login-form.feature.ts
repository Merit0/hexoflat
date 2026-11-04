import { BaseFeature } from '@framework/base-feature';
import { LoginPage } from '@pages/login.page';
import { AuthText, GUARDIAN_EMAIL } from '@config/test-data';

export class VerifyLoginFormFeature extends BaseFeature {
  private readonly loginPage = new LoginPage();

  async verifyLoginModeIsUsable(): Promise<void> {
    await this.step('Verify the sign-in form is complete and interactive', async () => {
      await this.loginPage.gotoLogin();

      await this.loginPage.tabs.verifySelected('signin');
      await this.loginPage.signIn.verifyFormIsComplete();
      await this.loginPage.signIn.verifyRememberIsOnByDefault();
      await this.loginPage.signIn.verifyPasskeyVisible();

      await this.loginPage.signIn.fillCredentials('someone', 'whatever123');
      await this.loginPage.signIn.verifyTypedValues('someone', 'whatever123');
    });
  }

  async verifyEmptySubmitShowsErrors(): Promise<void> {
    await this.step('Verify empty and half-filled submits explain what is missing', async () => {
      await this.loginPage.gotoLogin();

      await this.loginPage.signIn.submit();
      await this.loginPage.signIn.verifyError(AuthText.nameRequired);

      await this.loginPage.signIn.fillCredentials('someone', '');
      await this.loginPage.signIn.submit();
      await this.loginPage.signIn.verifyError(AuthText.passwordRequired);
    });
  }

  async verifyErrorClearsOnEdit(): Promise<void> {
    await this.step('Verify an error disappears as soon as a field is edited', async () => {
      await this.loginPage.gotoLogin();
      await this.loginPage.signIn.submit();
      await this.loginPage.signIn.verifyError(AuthText.nameRequired);

      await this.loginPage.signIn.fillCredentials('a', '');
      await this.loginPage.signIn.verifyErrorIsGone();
    });
  }

  async verifyRegisterModeIsUsable(): Promise<void> {
    await this.step(
      'Verify the New hero form is complete and sign-in-only fields are absent',
      async () => {
        await this.loginPage.gotoRegister();

        await this.loginPage.verifyUrlIsNewHero();
        await this.loginPage.tabs.verifySelected('new');
        await this.loginPage.signUp.verifyFormIsComplete();
        await this.loginPage.signUp.verifySignInOnlyFieldsAreAbsent();
        await this.loginPage.signUp.verifyGradeSelected(4);

        await this.loginPage.signUp.fillName('Real');
        await this.loginPage.signUp.verifyNameValue('Real');
        await this.loginPage.signUp.verifyForgeLabel('2 / 4');
        await this.loginPage.signUp.fillPassword('Strong-pass-1');
        await this.loginPage.signUp.fillGuardian(GUARDIAN_EMAIL);
        await this.loginPage.signUp.verifyForgeLabel('Ready!');
      },
    );
  }

  async verifyRegisterRouteSurvivesReload(): Promise<void> {
    await this.step('Verify /register lands on New hero and survives a reload', async () => {
      await this.loginPage.gotoRegister();
      await this.loginPage.verifyUrlIsNewHero();

      await this.loginPage.reload();

      await this.loginPage.verifyUrlIsNewHero();
      await this.loginPage.tabs.verifySelected('new');
      await this.loginPage.signUp.verifyFormIsComplete();
    });
  }

  async verifySignUpValidation(): Promise<void> {
    await this.step('Verify New hero validation messages in order', async () => {
      await this.loginPage.gotoRegister();

      await this.loginPage.signUp.submit();
      await this.loginPage.signUp.verifyError(AuthText.newNameRequired);

      await this.loginPage.signUp.fillName('Tester');
      await this.loginPage.signUp.fillPassword('abc');
      await this.loginPage.signUp.verifyStrength('Weak');
      await this.loginPage.signUp.submit();
      await this.loginPage.signUp.verifyError(AuthText.weakPassword);

      await this.loginPage.signUp.fillPassword('Strong-pass-1');
      await this.loginPage.signUp.verifyStrength('Legendary');
      await this.loginPage.signUp.submit();
      await this.loginPage.signUp.verifyError(AuthText.guardianRequired);
    });
  }
}
