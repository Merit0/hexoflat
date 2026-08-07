import { test, expect } from '../support/fixtures';
import { loginAsTestUser } from '../support/login';
import { API_URL } from '../support/env';

// The first test needs a real login (it's proving the reload-after-real-
// login flow), and the second deliberately floods /auth/login — both want
// to start from a clean slate rather than the shared pre-authenticated
// storage state the fixtures otherwise apply.
test.use({ storageState: { cookies: [], origins: [] } });

test('Verify several reloads in a row on the camp map do not 429 the silent session restore', async ({
  page,
  workerTestUser,
}) => {
  await loginAsTestUser(page, workerTestUser);

  const sessionStatuses: number[] = [];
  page.on('response', (response) => {
    if (new URL(response.url()).pathname === '/auth/session') {
      sessionStatuses.push(response.status());
    }
  });

  for (let i = 0; i < 6; i += 1) {
    await page.reload();
    await expect(page).toHaveURL(/\/world\/camping/);
    await expect(page.getByTestId('hex-map')).toBeVisible();
  }

  expect(sessionStatuses.length).toBe(6);
  expect(sessionStatuses.every((status) => status === 200)).toBe(true);
});

test('Verify a realistic CI burst against POST /auth/login stays under the non-production throttle ceiling', async ({
  request,
}) => {
  // Proves the CI/local throttle budget is large enough for a full parallel
  // e2e run to hammer /auth/login without ever tripping 429 — see
  // apps/api/src/auth/auth-throttle.env.ts's NON_PRODUCTION_AUTH_THROTTLE_LIMIT
  // (currently 2000/60s, vs. 5/60s in production). The proof that production
  // actually blocks at 5 requests lives in
  // apps/api/src/auth/auth.throttle.spec.ts, pinned explicitly via
  // AuthModule.forRoot(PRODUCTION_AUTH_THROTTLE_LIMIT) so it doesn't depend on
  // that test process's real NODE_ENV.
  //
  // Calls the API directly (bypassing the UI) so this fires fast and
  // deterministically, without depending on click/type timing.
  const BURST_SIZE = 50;

  const statuses: number[] = [];
  for (let i = 0; i < BURST_SIZE; i += 1) {
    const response = await request.post(`${API_URL}/auth/login`, {
      data: { username: 'rate-limit-probe', password: 'wrong' },
      failOnStatusCode: false,
    });
    statuses.push(response.status());
  }

  expect(statuses.every((status) => status === 401)).toBe(true);
});
