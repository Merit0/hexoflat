import { test, expect } from '@playwright/test';
import { loginAsTestUser, waitForCampingMapReady } from '../support/login';
import { readTestUser } from '../support/credentials';

// This file tests the login flow itself, so it opts out of the
// pre-authenticated storage state playwright.config.ts otherwise applies —
// it needs to start every test genuinely logged out.
test.use({ storageState: { cookies: [], origins: [] } });

test('Verify login redirects to the camping map', async ({ page }) => {
  await loginAsTestUser(page);

  await expect(page.getByTestId('hex-map')).toBeVisible();
  await expect(page.getByTestId('topbar')).toBeVisible();
  await expect(page.getByTestId('topbar-map-chip')).toContainText('Camping');
});

test('Verify a freshly logged-in hero starts with base 10 HP, not the 0/100 fallback', async ({
  page,
}) => {
  await loginAsTestUser(page);

  // GET /heroes/me auto-creates the hero on first fetch (see
  // heroes.service.ts's findOrCreateByUserId) — this is that very first
  // fetch, so it's the real regression check for the "0/100" bug: without
  // the fix, no heroes row exists yet and the client falls back to
  // HeroModel's blank-slate defaults (currentHealth 0, maxHealth 100)
  // instead of the intended starting stats.
  await expect(page.getByTestId('topbar-hp-value')).toHaveText('10/10');
});

test('Verify login rejects an unknown user with an inline error', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('login-username-input').fill('does-not-exist');
  await page.getByTestId('login-password-input').fill('whatever');
  await page.getByTestId('login-submit-button').click();

  await expect(page.getByTestId('login-error-message')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test('Verify "remember me" checked sets a persistent session cookie', async ({ page }) => {
  await loginAsTestUser(page);

  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find((cookie) => cookie.name === 'session');

  expect(sessionCookie).toBeDefined();
  expect(sessionCookie?.expires).toBeGreaterThan(Date.now() / 1000);
});

test('Verify "remember me" unchecked sets a browser-session cookie', async ({ page }) => {
  const user = readTestUser();

  await page.goto('/');
  await page.getByTestId('login-username-input').fill(user.username);
  await page.getByTestId('login-password-input').fill(user.password);
  await page.getByTestId('login-remember-me-checkbox').uncheck();
  await page.getByTestId('login-submit-button').click();

  await waitForCampingMapReady(page);

  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find((cookie) => cookie.name === 'session');

  expect(sessionCookie).toBeDefined();
  // Playwright reports -1 for cookies with no Max-Age/Expires (browser-session cookies).
  expect(sessionCookie?.expires).toBe(-1);
});
