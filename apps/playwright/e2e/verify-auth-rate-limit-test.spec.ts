import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../support/login';
import { API_URL } from '../support/env';

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

  // 6 reloads, one more than the login/register throttle's 5-req/60s limit —
  // GET /auth/session used to share that same numeric ceiling before it got
  // @SkipThrottle() (see auth.controller.ts), so this is exactly the repro
  // that used to 429 a perfectly valid session on ordinary refreshing.
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
  for (let i = 0; i < 10; i += 1) {
    const response = await request.post(`${API_URL}/auth/login`, {
      data: { username: 'rate-limit-probe', password: 'wrong' },
      failOnStatusCode: false,
    });
    statuses.push(response.status());
  }

  const firstBlockedIndex = statuses.indexOf(429);
  expect(firstBlockedIndex).toBeGreaterThan(-1);
  expect(statuses.slice(0, firstBlockedIndex).every((status) => status === 401)).toBe(true);
  expect(statuses.slice(firstBlockedIndex).every((status) => status === 429)).toBe(true);
});
