import { test } from '@fixtures';
import { BurstLoginFeature } from '@features/auth/burst-login.feature';
import { RecordSessionRequestsFeature } from '@features/auth/record-session-requests.feature';
import { VerifyAuthApiFeature } from '@features/auth/verify-auth-api.feature';
import { LoginUserFeature } from '@features/auth/login-user.feature';
import { ReloadCampingMapFeature } from '@features/world/reload-camping-map.feature';

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

  const recorder = new RecordSessionRequestsFeature();
  await recorder.record();

  const reload = new ReloadCampingMapFeature();
  for (let i = 0; i < RELOAD_COUNT; i += 1) {
    await reload.reload();
  }

  const verifyAuthApi = new VerifyAuthApiFeature();
  verifyAuthApi.verifyStatusCountEquals(recorder.readStatuses(), RELOAD_COUNT);
  verifyAuthApi.verifyAllStatusesAre(recorder.readStatuses(), 200);
});

test('Verify a realistic CI burst against POST /auth/login stays under the non-production throttle ceiling', async () => {
  const statuses = await new BurstLoginFeature().burst(LOGIN_BURST_SIZE);

  // 401 for every attempt, never 429: the burst was rejected on credentials,
  // not on the rate limiter.
  new VerifyAuthApiFeature().verifyAllStatusesAre(statuses, 401);
});
