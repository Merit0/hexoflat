import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../support/login';
import { API_URL } from '../support/env';

// The first test needs a real login (it's proving the reload-after-real-
// login flow), and the second deliberately floods /auth/login — both want
// to start from a clean slate rather than the shared pre-authenticated
// storage state playwright.config.ts otherwise applies.
test.use({ storageState: { cookies: [], origins: [] } });

test('Verify several reloads in a row on the camp map do not 429 the silent session restore', async ({
  page,
}) => {
  await loginAsTestUser(page);

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

test('Verify POST /auth/login is still rate-limited after repeated failed attempts', async ({
  request,
}) => {
  // This deliberately exhausts /auth/login's throttle bucket, and then waits
  // it back out before returning (see below) — so it can run in any position
  // in the suite without leaving that bucket poisoned for whichever spec
  // happens to run next and needs a real login of its own (verify-login-test,
  // verify-session-restore-test). The wait can run past the default 30s
  // test timeout, hence the bump.
  test.setTimeout(90_000);

  // Calls the API directly (bypassing the UI) so this can fire past the
  // limit fast and deterministically, without depending on click/type
  // timing. This is the flip side of the test above: proves the
  // @SkipThrottle() fix for /auth/session didn't accidentally loosen the
  // actual brute-force protection on /auth/login.
  //
  // Doesn't assert a fixed "5th ok, 6th blocked" boundary: this endpoint's
  // throttle bucket is shared (by IP+route) with whatever else in this test
  // run already called it — e.g. the test above's loginAsTestUser — so the
  // exact count remaining when this test starts isn't guaranteed. 10 attempts
  // is comfortably past the 5-req/60s budget regardless of that head start;
  // what matters is that throttling kicks in and, once it does, stays on.
  const statuses: number[] = [];
  let lastResponseHeaders: Record<string, string> = {};
  for (let i = 0; i < 10; i += 1) {
    const response = await request.post(`${API_URL}/auth/login`, {
      data: { username: 'rate-limit-probe', password: 'wrong' },
      failOnStatusCode: false,
    });
    statuses.push(response.status());
    lastResponseHeaders = response.headers();
  }

  const firstBlockedIndex = statuses.indexOf(429);
  expect(firstBlockedIndex).toBeGreaterThan(-1);
  expect(statuses.slice(0, firstBlockedIndex).every((status) => status === 401)).toBe(true);
  expect(statuses.slice(firstBlockedIndex).every((status) => status === 429)).toBe(true);

  // Wait out the window this just tripped (server reports exactly how long
  // in `Retry-After`), plus a small buffer, so it's reset by the time the
  // next spec file runs.
  const retryAfterSeconds = Number(lastResponseHeaders['retry-after'] ?? 60);
  await new Promise((resolve) => setTimeout(resolve, (retryAfterSeconds + 2) * 1000));
});
