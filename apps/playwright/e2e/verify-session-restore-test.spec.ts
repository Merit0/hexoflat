import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../support/login';

test('Verify a page refresh restores the session instead of forcing a relogin', async ({
  page,
}) => {
  await loginAsTestUser(page);

  await page.reload();

  // A failed silent restore (GET /auth/session) would have the router's
  // beforeEach guard bounce this straight back to /login before the reload
  // repaints anything — landing on the camping map is the actual proof the
  // httpOnly session cookie round-tripped, not just that the page loaded.
  await expect(page).toHaveURL(/\/world\/camping/);
  await expect(page.getByTestId('hex-map')).toBeVisible();
  await expect(page.getByTestId('topbar')).toBeVisible();
});

test('Verify logging out clears the session cookie so a refresh does not silently relogin', async ({
  page,
}) => {
  await loginAsTestUser(page);

  // dispatchEvent, not click() — the adjacent topbar__logger/game-events-logger
  // panel visually overlaps the logout button at this viewport size and would
  // absorb a real mouse click at that screen position (a pre-existing topbar
  // layering quirk, unrelated to what this test verifies: that logging out
  // actually clears the session cookie). Dispatching the DOM event directly
  // on the button sidesteps the hit-testing entirely.
  await page.getByTestId('topbar-logout-button').dispatchEvent('click');
  await expect(page).toHaveURL(/\/login/);

  await page.reload();

  await expect(page).toHaveURL(/\/login/);
});
