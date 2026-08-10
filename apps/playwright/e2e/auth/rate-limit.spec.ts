import { test } from '@fixtures';
import { AuthApiFeature } from '@features/auth/auth-api.feature';
import { LoginUserFeature } from '@features/auth/login-user.feature';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';

// The first test needs a real login (it's proving the reload-after-real-login
// flow) and the second deliberately floods /auth/login — both want to start
// from a clean slate rather than the shared pre-authenticated storage state.
test.use({ storageState: { cookies: [], origins: [] } });

const RELOAD_COUNT = 6;
const LOGIN_BURST_SIZE = 50;

test('Verify several reloads in a row on the camp map do not 429 the silent session restore', async ({
  workerTestUser,
}) => {
  await new LoginUserFeature(workerTestUser).login();

  const authApi = new AuthApiFeature();
  await authApi.startRecordingSessionRequests();

  const campingMap = new OpenCampingMapFeature();
  for (let reload = 0; reload < RELOAD_COUNT; reload += 1) {
    await campingMap.reloadAndWaitReady();
  }

  await authApi.verifySessionRequestsAllSucceeded(RELOAD_COUNT);
});

test('Verify a realistic CI burst against POST /auth/login stays under the non-production throttle ceiling', async () => {
  const authApi = new AuthApiFeature();

  const statuses = await authApi.burstLogin(LOGIN_BURST_SIZE);

  // 401 for every attempt, never 429: the burst was rejected on credentials,
  // not on the rate limiter.
  authApi.verifyEveryStatusIs(statuses, 401);
});
