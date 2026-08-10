import { test } from '@fixtures';
import { LoginUserFeature } from '@features/auth/login-user.feature';
import { LogoutUserFeature } from '@features/auth/logout-user.feature';
import { VerifySessionFeature } from '@features/auth/verify-session.feature';
import { ReloadCampingMapFeature } from '@features/world/reload-camping-map.feature';
import { VerifyCampingBoardFeature } from '@features/world/verify-camping-board.feature';

// This file tests the login/session-restore flow itself, so it opts out of
// the pre-authenticated storage state the fixtures otherwise apply — every
// test here has to start genuinely logged out.
test.use({ storageState: { cookies: [], origins: [] } });

test('Verify a page refresh restores the session instead of forcing a relogin', async ({
  workerTestUser,
}) => {
  await new LoginUserFeature(workerTestUser).login();

  // A failed silent restore (GET /auth/session) would have the router's
  // beforeEach guard bounce this straight back to /login before the reload
  // repaints anything — landing on the camping board is the actual proof the
  // httpOnly session cookie round-tripped, not just that the page loaded.
  await new ReloadCampingMapFeature().reload();
  await new VerifyCampingBoardFeature().verifyBoardReady();
});

test('Verify logging out clears the session cookie so a refresh does not silently relogin', async ({
  workerTestUser,
}) => {
  await new LoginUserFeature(workerTestUser).login();

  await new LogoutUserFeature().logout();
  await new VerifySessionFeature().verifyRefreshDoesNotRelogin();
});
