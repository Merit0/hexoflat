import { test } from '@fixtures';
import { LoginUserFeature } from '@features/auth/login-user.feature';
import { OpenRegisterFeature } from '@features/auth/open-register.feature';
import { VerifyCampingBoardFeature } from '@features/world/verify-camping-board.feature';
import { VerifySessionFeature } from '@features/auth/verify-session.feature';
import { VerifyLoginFormFeature } from '@features/auth/verify-login-form.feature';
import { VerifyRegisterRouteFeature } from '@features/auth/verify-register-route.feature';

// This file tests the login flow itself, so it opts out of the
// pre-authenticated storage state the fixtures otherwise apply — every test
// here has to start genuinely logged out.
test.use({ storageState: { cookies: [], origins: [] } });

test('Verify login redirects to the camping map', async ({ workerTestUser }) => {
  await new LoginUserFeature(workerTestUser).login();

  const board = new VerifyCampingBoardFeature();
  await board.verifyBoardReady();
  await board.verifyMapChipIsCamping();
});

test('Verify a freshly logged-in hero starts with base 10 HP, not the 0/100 fallback', async ({
  workerTestUser,
}) => {
  await new LoginUserFeature(workerTestUser).login();

  await new VerifyCampingBoardFeature().verifyHeroStartsWithBaseHealth();
});

test('Verify login rejects an unknown user with an inline error', async ({ workerTestUser }) => {
  await new LoginUserFeature(workerTestUser).loginExpectingError('does-not-exist', 'whatever');
});

test('Verify "remember me" checked sets a persistent session cookie', async ({
  workerTestUser,
}) => {
  await new LoginUserFeature(workerTestUser).login();

  await new VerifySessionFeature().verifyCookieIsPersistent();
});

test('Verify "remember me" unchecked sets a browser-session cookie', async ({ workerTestUser }) => {
  await new LoginUserFeature(workerTestUser).loginWithoutRememberMe();

  await new VerifySessionFeature().verifyCookieIsBrowserSessionOnly();
});

test('Verify register mode survives a page reload via its own /register route', async () => {
  await new OpenRegisterFeature().open();

  await new VerifyRegisterRouteFeature().verifySurvivesReload();
});

test('Verify all login-page elements are present, interactive, and register-only fields are absent', async () => {
  await new VerifyLoginFormFeature().verifyLoginModeIsUsable();
});

test('Verify all register-page elements are present, interactive, and login-only fields are absent', async () => {
  await new VerifyLoginFormFeature().verifyRegisterModeIsUsable();
});

test('Verify a direct visit to /register is not redirected to /login on reload', async () => {
  const verifyRoute = new VerifyRegisterRouteFeature();

  await verifyRoute.verifyDirectUrlSurvivesReload();
  await verifyRoute.verifyToggleBackToLoginWorks();
});
