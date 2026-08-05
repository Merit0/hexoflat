import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../support/login';

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
