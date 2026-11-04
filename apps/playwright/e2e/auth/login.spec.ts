import { test } from '@fixtures';
import { LoginUserFeature } from '@features/auth/login-user.feature';
import { RegisterUserViaUiFeature } from '@features/auth/register-user-via-ui.feature';
import { VerifyCampingBoardFeature } from '@features/world/verify-camping-board.feature';
import { VerifySessionFeature } from '@features/auth/verify-session.feature';
import { VerifyLoginFormFeature } from '@features/auth/verify-login-form.feature';

test.describe('login', { tag: ['@auth'] }, () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test(
    'Verify login redirects to the camping map',
    { tag: '@smoke' },
    async ({ workerTestUser }) => {
      await new LoginUserFeature(workerTestUser).login();

      const board = new VerifyCampingBoardFeature();
      await board.verifyBoardReady();
      await board.verifyMapChipIsCamping();
    },
  );

  test('Verify a freshly logged-in hero starts with base 10 HP, not the 0/100 fallback', async ({
    workerTestUser,
  }) => {
    await new LoginUserFeature(workerTestUser).login();

    await new VerifyCampingBoardFeature().verifyHeroStartsWithBaseHealth();
  });

  test('Verify login rejects an unknown user with the credentials error', async ({
    workerTestUser,
  }) => {
    await new LoginUserFeature(workerTestUser).loginExpectingError('does-not-exist', 'whatever');
  });

  test('Verify "keep me signed in" on sets a persistent session cookie', async ({
    workerTestUser,
  }) => {
    await new LoginUserFeature(workerTestUser).login();

    await new VerifySessionFeature().verifyCookieIsPersistent();
  });

  test('Verify "keep me signed in" off sets a browser-session cookie', async ({
    workerTestUser,
  }) => {
    await new LoginUserFeature(workerTestUser).loginWithoutRememberMe();

    await new VerifySessionFeature().verifyCookieIsBrowserSessionOnly();
  });

  test('Verify a new hero created from the New hero tab reaches the camping map', async () => {
    await new RegisterUserViaUiFeature().register();

    await new VerifyCampingBoardFeature().verifyMapChipIsCamping();
  });

  test('Verify /register lands on the New hero tab and survives a reload', async () => {
    await new VerifyLoginFormFeature().verifyRegisterRouteSurvivesReload();
  });

  test('Verify all sign-in elements are present and interactive', async () => {
    await new VerifyLoginFormFeature().verifyLoginModeIsUsable();
  });

  test('Verify empty and half-filled sign-in submits explain what is missing', async () => {
    await new VerifyLoginFormFeature().verifyEmptySubmitShowsErrors();
  });

  test('Verify a sign-in error clears as soon as a field is edited', async () => {
    await new VerifyLoginFormFeature().verifyErrorClearsOnEdit();
  });

  test('Verify the New hero form is complete and drives the forge meter', async () => {
    await new VerifyLoginFormFeature().verifyRegisterModeIsUsable();
  });

  test('Verify New hero validation messages come in order', async () => {
    await new VerifyLoginFormFeature().verifySignUpValidation();
  });
});
