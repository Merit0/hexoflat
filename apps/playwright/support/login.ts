import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { readTestUser } from './credentials';

export async function loginAsTestUser(page: Page): Promise<void> {
  const user = readTestUser();

  await page.goto('/');
  await page.getByTestId('login-username-input').fill(user.username);
  await page.getByTestId('login-password-input').fill(user.password);
  await page.getByTestId('login-submit-button').click();

  await expect(page).toHaveURL(/\/world\/camping/);
  await expect(page.getByTestId('map-scene-root')).toBeVisible();
  // The board canvas is only sized (and clickable at the right position)
  // once mapBounds settles — see the ResizeObserver comment in
  // hex-world-map.vue. Waiting for a non-zero box up front means every
  // later canvas click already lands on real geometry.
  await expect
    .poll(async () => (await page.getByTestId('hex-board-canvas').boundingBox())?.width ?? 0)
    .toBeGreaterThan(0);
}
