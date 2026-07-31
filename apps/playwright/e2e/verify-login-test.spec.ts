import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../support/login';

test('Verify login redirects to the camping map', async ({ page }) => {
  await loginAsTestUser(page);

  await expect(page.getByTestId('hex-map')).toBeVisible();
  await expect(page.getByTestId('topbar')).toBeVisible();
  await expect(page.getByTestId('topbar-map-chip')).toContainText('Camping');
});

test('Verify login rejects an unknown user with an inline error', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('login-username-input').fill('does-not-exist');
  await page.getByTestId('login-password-input').fill('whatever');
  await page.getByTestId('login-submit-button').click();

  await expect(page.getByTestId('login-error-message')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
