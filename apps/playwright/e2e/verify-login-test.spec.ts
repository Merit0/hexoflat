import { test, expect } from '../support/fixtures';
import { loginAsTestUser, waitForCampingMapReady } from '../support/login';

// This file tests the login flow itself, so it opts out of the
// pre-authenticated storage state the fixtures otherwise apply — it needs to
// start every test genuinely logged out.
test.use({ storageState: { cookies: [], origins: [] } });

test('Verify login redirects to the camping map', async ({ page, workerTestUser }) => {
  await loginAsTestUser(page, workerTestUser);

  await expect(page.getByTestId('hex-map')).toBeVisible();
  await expect(page.getByTestId('topbar')).toBeVisible();
  await expect(page.getByTestId('topbar-map-chip')).toContainText('Camping');
});

test('Verify a freshly logged-in hero starts with base 10 HP, not the 0/100 fallback', async ({
  page,
  workerTestUser,
}) => {
  await loginAsTestUser(page, workerTestUser);

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

test('Verify "remember me" checked sets a persistent session cookie', async ({
  page,
  workerTestUser,
}) => {
  await loginAsTestUser(page, workerTestUser);

  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find((cookie) => cookie.name === 'session');

  expect(sessionCookie).toBeDefined();
  expect(sessionCookie?.expires).toBeGreaterThan(Date.now() / 1000);
});

test('Verify "remember me" unchecked sets a browser-session cookie', async ({
  page,
  workerTestUser,
}) => {
  await page.goto('/');
  await page.getByTestId('login-username-input').fill(workerTestUser.username);
  await page.getByTestId('login-password-input').fill(workerTestUser.password);
  await page.getByTestId('login-remember-me-checkbox').uncheck();
  await page.getByTestId('login-submit-button').click();

  await waitForCampingMapReady(page);

  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find((cookie) => cookie.name === 'session');

  expect(sessionCookie).toBeDefined();
  // Playwright reports -1 for cookies with no Max-Age/Expires (browser-session cookies).
  expect(sessionCookie?.expires).toBe(-1);
});

test('Verify register mode survives a page reload via its own /register route', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByTestId('login-toggle-mode-button').click();

  await expect(page).toHaveURL(/\/register/);
  await expect(page.getByTestId('register-name-input')).toBeVisible();

  await page.reload();

  await expect(page).toHaveURL(/\/register/);
  await expect(page.getByTestId('register-name-input')).toBeVisible();
  await expect(page.getByTestId('login-toggle-mode-button')).toHaveText('Back to login');
});

test('Verify all login-page elements are present, interactive, and register-only fields are absent', async ({
  page,
}) => {
  await page.goto('/login');

  await expect(page.getByTestId('login-username-input')).toBeVisible();
  await expect(page.getByTestId('login-password-input')).toBeVisible();
  await expect(page.getByTestId('login-toggle-password-button')).toBeVisible();
  await expect(page.getByTestId('login-remember-me-checkbox')).toBeVisible();
  // Default matters here: unchecked-by-default would silently regress every
  // user who never touches the box from "stays logged in" to "logged out on
  // browser close" — see docs/REMEMBER-ME-PLAN.md.
  await expect(page.getByTestId('login-remember-me-checkbox')).toBeChecked();
  await expect(page.getByTestId('login-submit-button')).toHaveText('PLAY');
  await expect(page.getByTestId('login-toggle-mode-button')).toHaveText('Create account');

  // Register-only fields must not leak into login mode.
  await expect(page.getByTestId('register-name-input')).toHaveCount(0);
  await expect(page.getByTestId('register-confirm-password-input')).toHaveCount(0);
  await expect(page.getByTestId('register-password-hint')).toHaveCount(0);

  // Prove the fields are genuinely interactive, not just present in the DOM.
  await page.getByTestId('login-username-input').fill('someone');
  await page.getByTestId('login-password-input').fill('whatever123');
  await page.getByTestId('login-toggle-password-button').click();
  await expect(page.getByTestId('login-username-input')).toHaveValue('someone');
  await expect(page.getByTestId('login-password-input')).toHaveValue('whatever123');
  await expect(page.getByTestId('login-password-input')).toHaveAttribute('type', 'text');
});

test('Verify all register-page elements are present, interactive, and login-only fields are absent', async ({
  page,
}) => {
  await page.goto('/register');

  await expect(page.getByTestId('register-name-input')).toBeVisible();
  await expect(page.getByTestId('login-username-input')).toBeVisible();
  await expect(page.getByTestId('login-password-input')).toBeVisible();
  await expect(page.getByTestId('register-confirm-password-input')).toBeVisible();
  await expect(page.getByTestId('register-password-hint')).toContainText('8 characters');
  await expect(page.getByTestId('login-submit-button')).toHaveText('REGISTER');
  await expect(page.getByTestId('login-toggle-mode-button')).toHaveText('Back to login');

  // Login-only field must not leak into register mode.
  await expect(page.getByTestId('login-remember-me-checkbox')).toHaveCount(0);

  // Prove the fields are genuinely interactive, not just present in the DOM.
  await page.getByTestId('register-name-input').fill('Real User');
  await page.getByTestId('login-username-input').fill('real-user');
  await page.getByTestId('login-password-input').fill('longenoughpw');
  await page.getByTestId('register-confirm-password-input').fill('longenoughpw');
  await expect(page.getByTestId('register-name-input')).toHaveValue('Real User');
  await expect(page.getByTestId('login-username-input')).toHaveValue('real-user');
});

test('Verify a direct visit to /register is not redirected to /login on reload', async ({
  page,
}) => {
  // Simulates a bookmarked/shared link — the router must resolve /register
  // directly (not via the "Create account" toggle button), and
  // login-form.vue's defensive `userStore.logout()` call on mount must not
  // force-navigate back to /login. That force-navigate was a real bug: it
  // was unconditional and harmless only because this component used to
  // render exclusively at /login — reloading a direct /register visit
  // bounced straight back to /login until fixed.
  await page.goto('/register');
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByTestId('register-name-input')).toBeVisible();

  await page.reload();

  await expect(page).not.toHaveURL(/\/login$/);
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByTestId('register-name-input')).toBeVisible();
  await expect(page.getByTestId('login-toggle-mode-button')).toHaveText('Back to login');

  // Prove the toggle still actually works post-reload, not just that the
  // route survived the reload.
  await page.getByTestId('login-toggle-mode-button').click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByTestId('register-name-input')).toHaveCount(0);
});
